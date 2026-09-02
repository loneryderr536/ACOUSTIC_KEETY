import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/stripe/client';
import { isDuplicateEvent, markEventProcessed } from '@/stripe/events';
import * as handlers from '@/stripe/handlers';

/**
 * Connect webhook endpoint (separate signing secret from the platform one).
 *
 * Added over the previous version: dedup, and `capability.updated`. The latter
 * matters — an Express account often flips to payouts-enabled via a capability
 * event rather than a fresh `account.updated`, and without it the payout
 * engine keeps seeing a provider as not-onboarded.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('[stripe-connect] Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  if (await isDuplicateEvent(event.id)) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await handlers.handleAccountUpdated(event.data.object);
        break;

      case 'capability.updated':
        await handlers.handleCapabilityUpdated(event.data.object);
        break;

      default:
        console.log(`[stripe-connect] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error('[stripe-connect] Error handling event:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  await markEventProcessed(event.id, event.type);
  return NextResponse.json({ received: true });
}
