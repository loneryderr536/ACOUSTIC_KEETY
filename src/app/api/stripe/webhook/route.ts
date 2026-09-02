import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/prisma';
import { getPlanConfig } from '@/lib/plans';

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

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        const planKey = session.metadata?.plan;
        if (!userId || !planKey) {
          console.error('[stripe] checkout.session.completed missing metadata:', { userId, planKey });
          break;
        }
        const cfg = getPlanConfig(planKey);
        await prisma.user.update({
          where: { id: userId },
          data: {
            plan: planKey,
            callsLimit: cfg.callsLimit,
            callsBalance: cfg.callsLimit,
            dailyAllowance: cfg.dailyAllowance,
            dailyCeiling: cfg.dailyCeiling,
            stripeCustomerId: session.customer as string,
          },
        });
        console.log(`[stripe] User ${userId} upgraded to ${planKey}`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (!user) break;

        // Handle past_due or unpaid — downgrade to prevent free usage
        if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
          const freeCfg = getPlanConfig('recruit');
          await prisma.user.update({
            where: { id: user.id },
            data: {
              plan: 'recruit',
              callsLimit: freeCfg.callsLimit,
              callsBalance: freeCfg.callsLimit,
              dailyAllowance: freeCfg.dailyAllowance,
              dailyCeiling: freeCfg.dailyCeiling,
            },
          });
          console.log(`[stripe] Subscription ${subscription.status} for user ${user.id}, downgraded to recruit`);
        } else if (subscription.status === 'active') {
          // Re-activate if they fix payment — restore their current plan limits
          const priceId = subscription.items?.data?.[0]?.price?.id;
          const cfg = getPlanConfig(user.plan);
          await prisma.user.update({
            where: { id: user.id },
            data: {
              callsLimit: cfg.callsLimit,
              callsBalance: cfg.callsLimit,
              dailyAllowance: cfg.dailyAllowance,
              dailyCeiling: cfg.dailyCeiling,
            },
          });
          console.log(`[stripe] Subscription reactivated for user ${user.id}, price: ${priceId}`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer as string;

        // Check if the customer still has an active subscription (upgrade scenario:
        // old sub is cancelled but new one is active — don't downgrade)
        const remaining = await stripe.subscriptions.list({
          customer: customerId,
          status: 'active',
          limit: 1,
        });
        if (remaining.data.length > 0) {
          console.log(`[stripe] Subscription cancelled for customer ${customerId}, but another active sub exists — skipping downgrade`);
          break;
        }

        const freeCfgDel = getPlanConfig('recruit');
        await prisma.user.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            plan: 'recruit',
            callsLimit: freeCfgDel.callsLimit,
            callsBalance: freeCfgDel.callsLimit,
            dailyAllowance: freeCfgDel.dailyAllowance,
            dailyCeiling: freeCfgDel.dailyCeiling,
          },
        });
        console.log(`[stripe] Subscription cancelled for customer ${customerId}, downgraded to recruit`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer as string;
        const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (user) {
          // Downgrade immediately on payment failure
          const freeCfgPay = getPlanConfig('recruit');
          await prisma.user.update({
            where: { id: user.id },
            data: {
              plan: 'recruit',
              callsLimit: freeCfgPay.callsLimit,
              callsBalance: freeCfgPay.callsLimit,
              dailyAllowance: freeCfgPay.dailyAllowance,
              dailyCeiling: freeCfgPay.dailyCeiling,
            },
          });
          console.log(`[stripe] Payment failed for user ${user.id}, downgraded to recruit`);
        }
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_succeeded': {
        // Monthly credit reset — credits expire at the end of each billing
        // period (see docs/CONTEXT.md "expire monthly" decision). Fresh
        // allocation on every successful renewal. Skip the initial
        // invoice tied to checkout.session.completed — that one already
        // set callsBalance.
        const invoice = event.data.object;
        const customerId = invoice.customer as string;
        const billingReason = invoice.billing_reason as string | null | undefined;

        // `subscription_create` is the first-period invoice — already
        // handled by checkout.session.completed. Only reset on renewals
        // and manual top-ups.
        if (billingReason === 'subscription_create') {
          break;
        }

        const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
        if (!user) break;

        const cfg = getPlanConfig(user.plan);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            callsLimit: cfg.callsLimit,
            callsBalance: cfg.callsLimit,
            callsUsed: 0,
            dailyAllowance: cfg.dailyAllowance,
            dailyCeiling: cfg.dailyCeiling,
            lastReplenishAt: new Date(),
          },
        });
        console.log(`[stripe] Invoice paid for user ${user.id} (${billingReason ?? 'unknown'}), credits reset to ${cfg.callsLimit}`);
        break;
      }

      default:
        console.log(`[stripe] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    console.error(`[stripe] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
