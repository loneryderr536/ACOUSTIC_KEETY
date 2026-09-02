import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { resolveUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Stripe Connect is not yet enabled.' },
      { status: 503 },
    );
  }

  const user = await resolveUser(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || (railwayDomain ? `https://${railwayDomain}` : null)
    || request.headers.get('origin')
    || 'http://localhost:3000';

  let accountId = user.stripeAccountId;

  try {
    // Create a Connected Account if the user doesn't have one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        email: user.email,
        country: 'au',
        business_type: 'individual',
        capabilities: {
          transfers: { requested: true },
        },
        metadata: { userId: user.id },
      });
      accountId = account.id;
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeAccountId: accountId },
      });
    }

    // Create Account Link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${appUrl}/provider/dashboard`,
      return_url: `${appUrl}/provider/dashboard?stripe=connected&accountId=${accountId}`,
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (err) {
    console.error('[stripe-connect] Error:', err);
    return NextResponse.json(
      { error: 'Failed to set up Stripe Connect' },
      { status: 500 },
    );
  }
}

// GET: Check onboarding status for a connected account
export async function GET(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const user = await resolveUser(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!user.stripeAccountId) {
    return NextResponse.json({
      connected: false,
      onboardingComplete: false,
      readyToReceivePayments: false,
    });
  }

  try {
    const account = await stripe.accounts.retrieve(user.stripeAccountId);

    const readyToReceivePayments = account.charges_enabled && account.payouts_enabled;
    const onboardingComplete = account.details_submitted === true;

    return NextResponse.json({
      connected: true,
      onboardingComplete,
      readyToReceivePayments,
      accountId: user.stripeAccountId,
    });
  } catch (err) {
    console.error('[stripe-connect] Error retrieving account:', err);
    return NextResponse.json(
      { error: 'Failed to check Connect status' },
      { status: 500 },
    );
  }
}
