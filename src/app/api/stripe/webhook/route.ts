import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/stripe/client';
import { isDuplicateEvent, markEventProcessed } from '@/stripe/events';
import * as handlers from '@/stripe/handlers';

/**
 * Platform webhook endpoint. Thin on purpose — verify, dedup, dispatch.
 * All handler logic lives in `src/stripe/handlers.ts`.
 *
 * Next.js App Router route handlers receive the raw body via `request.text()`,
 * which is what signature verification needs. That replaces the standalone
 * service's `express.raw()` mounting order dance — there is no global JSON
 * body parser here to get in the way.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe] Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Stripe redelivers on retry. Without this, a redelivered invoice.paid
  // resets credits twice and double-counts revenue.
  if (await isDuplicateEvent(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handlers.handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handlers.handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handlers.handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        await handlers.handleInvoicePaid(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlers.handleInvoicePaymentFailed(event.data.object);
        break;

      case 'transfer.created':
      case 'transfer.updated':
      case 'transfer.reversed':
        await handlers.handleTransferEvent(event.data.object, event.type);
        break;

      case 'charge.dispute.created':
        await handlers.handleDisputeCreated(event.data.object);
        break;

      default:
        console.log(`[stripe] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Non-2xx tells Stripe to retry delivery later. The event stays unmarked,
    // so the retry is processed rather than deduped away.
    console.error(`[stripe] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  await markEventProcessed(event.id, event.type);
  return NextResponse.json({ received: true });
}
