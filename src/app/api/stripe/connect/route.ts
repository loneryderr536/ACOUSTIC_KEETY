import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUser } from '@/lib/auth';
import { getStripe } from '@/stripe/client';
import {
  appUrl,
  createConnectedAccount,
  createOnboardingLink,
  getAccountStatus,
} from '@/stripe/connect';

/** POST — start (or resume) Connect onboarding, returning a fresh account link. */
export async function POST(request: NextRequest) {
  if (!getStripe()) {
    return NextResponse.json({ error: 'Stripe Connect is not yet enabled.' }, { status: 503 });
  }

  const user = await resolveUser(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const accountId = user.stripeAccountId ?? (await createConnectedAccount(user));
    const url = await createOnboardingLink(accountId, appUrl(request.headers.get('origin')));
    return NextResponse.json({ url });
  } catch (err) {
    console.error('[stripe-connect] Error:', err);
    return NextResponse.json({ error: 'Failed to set up Stripe Connect' }, { status: 500 });
  }
}

/**
 * GET — check onboarding status live with Stripe, and opportunistically sync
 * chargesEnabled/payoutsEnabled into the DB. The webhook is still the
 * authoritative trigger; this is a convenience sync for when a provider comes
 * back and looks at their dashboard before the event lands.
 */
export async function GET(request: NextRequest) {
  if (!getStripe()) {
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
      chargesEnabled: false,
      payoutsEnabled: false,
    });
  }

  try {
    const status = await getAccountStatus(user.stripeAccountId);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        chargesEnabled: status.chargesEnabled,
        payoutsEnabled: status.payoutsEnabled,
        onboardingComplete: status.onboardingComplete || status.readyToReceivePayments,
      },
    });

    return NextResponse.json(status);
  } catch (err) {
    console.error('[stripe-connect] Error retrieving account:', err);
    return NextResponse.json({ error: 'Failed to check Connect status' }, { status: 500 });
  }
}
