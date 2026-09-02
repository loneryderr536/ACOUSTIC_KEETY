import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';

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

  try {
    switch (event.type) {
      case 'account.updated': {
        const account = event.data.object;
        const accountId = account.id;

        const onboardingComplete = account.details_submitted === true;
        const readyToReceivePayments = account.charges_enabled && account.payouts_enabled;

        if (onboardingComplete || readyToReceivePayments) {
          await prisma.user.updateMany({
            where: { stripeAccountId: accountId },
            data: { onboardingComplete: true },
          });
          console.log(`[stripe-connect] Account ${accountId} onboarding complete`);
        }
        break;
      }

      default:
        console.log(`[stripe-connect] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[stripe-connect] Error handling event:`, err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
