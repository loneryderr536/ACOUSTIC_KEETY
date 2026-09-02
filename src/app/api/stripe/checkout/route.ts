import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { resolveUser } from '@/lib/auth';
import { resolvePlan } from '@/lib/plans';

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Payments are not currently available. Please try again later.' },
      { status: 503 },
    );
  }

  const user = await resolveUser(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { plan } = await request.json();

  // Resolve legacy plan names (builder → field_agent, scale → double_0)
  const resolvedPlan = resolvePlan(plan);

  // Validate plan and price ID
  const priceMap: Record<string, string | undefined> = {
    field_agent: process.env.STRIPE_FIELD_AGENT_PRICE_ID,
    double_0: process.env.STRIPE_DOUBLE_0_PRICE_ID,
    shadow: process.env.STRIPE_SHADOW_PRICE_ID,
  };

  const priceId = priceMap[resolvedPlan];
  if (!priceId) {
    return NextResponse.json(
      { error: resolvedPlan in priceMap ? 'Price not configured for this plan yet' : 'Invalid plan' },
      { status: 400 },
    );
  }

  // Prevent double-subscribe — check if already on a paid plan
  if (user.plan === resolvedPlan) {
    return NextResponse.json(
      { error: `You are already on the ${resolvedPlan} plan` },
      { status: 409 },
    );
  }

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || (railwayDomain ? `https://${railwayDomain}` : null)
    || request.headers.get('origin')
    || 'http://localhost:3000';

  // If user already has a Stripe customer with active subscriptions, cancel them first
  // This prevents duplicate subscriptions when upgrading (builder → scale)
  if (user.stripeCustomerId) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
      });
      for (const sub of subs.data) {
        await stripe.subscriptions.cancel(sub.id, { prorate: true });
      }
    } catch (err) {
      console.error('[stripe] Failed to cancel existing subscriptions:', err);
    }
  }

  // Reuse existing Stripe customer if we have one, otherwise let Stripe create by email
  const customerParams: Record<string, unknown> = {
    metadata: { userId: user.id, plan: resolvedPlan },
  };
  if (user.stripeCustomerId) {
    customerParams.customer = user.stripeCustomerId;
  } else {
    customerParams.customer_email = user.email;
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      ...customerParams,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${appUrl}/dashboard?upgraded=true`,
      cancel_url: `${appUrl}/pricing`,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error('[stripe] Checkout session creation failed:', err);
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 },
    );
  }
}
