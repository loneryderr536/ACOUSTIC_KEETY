import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { resolveUser } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: 'Billing portal is not yet enabled.' },
      { status: 503 },
    );
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

  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    || (railwayDomain ? `https://${railwayDomain}` : null)
    || request.headers.get('origin')
    || 'http://localhost:3000';

  const session = await stripe.billingPortal.sessions.create({
    customer: user.stripeCustomerId,
    return_url: `${appUrl}/dashboard`,
  });

  return NextResponse.json({ url: session.url });
}
