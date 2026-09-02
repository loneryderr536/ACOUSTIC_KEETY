import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth';
import { getStripe } from '@/stripe/client';
import { createPortalSession } from '@/stripe/checkout';
import { appUrl } from '@/stripe/connect';

export async function POST(request: NextRequest) {
  if (!getStripe()) {
    return NextResponse.json({ error: 'Billing portal is not yet enabled.' }, { status: 503 });
  }

  const user = await resolveUser(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!user.stripeCustomerId) {
    return NextResponse.json(
      { error: 'No billing account found. You are on the free plan.' },
      { status: 400 },
    );
  }

  const url = await createPortalSession(user.stripeCustomerId, appUrl(request.headers.get('origin')));
  return NextResponse.json({ url });
}
