import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MIN_PAYOUT_CENTS } from '@/lib/payouts';

/**
 * GET /api/provider/payouts — list the calling provider's own payouts.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing or invalid Authorization header' },
      { status: 401 },
    );
  }

  const apiKey = authHeader.slice(7);
  const user = await prisma.user.findUnique({ where: { apiKey } });
  if (!user) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }
  if (user.role !== 'provider' && user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Only providers can access this endpoint' },
      { status: 403 },
    );
  }

  const payouts = await prisma.payout.findMany({
    where: { providerId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 24,
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      grossCents: true,
      providerShareCents: true,
      callCount: true,
      status: true,
      skipReason: true,
      failureReason: true,
      stripeTransferId: true,
      createdAt: true,
      paidAt: true,
    },
  });

  return NextResponse.json({
    payouts,
    minPayoutCents: MIN_PAYOUT_CENTS,
  });
}
