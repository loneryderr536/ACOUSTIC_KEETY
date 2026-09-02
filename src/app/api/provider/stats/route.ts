import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { PAYOUT_CURRENCY } from '@/stripe/client';
import { currentPeriodKey } from '@/stripe/period';
import { estimateProviderShare, MIN_PAYOUT_THRESHOLD_CENTS } from '@/stripe/monthly-payout';

/* ------------------------------------------------------------------ */
/*  GET /api/provider/stats — aggregate stats for provider's agents    */
/* ------------------------------------------------------------------ */
/**
 * Earnings here come from `estimateProviderShare`, the same computation the
 * monthly payout run uses.
 *
 * They used to come from the rolling engine — `creditsConsumed × 65%` — while
 * the pool engine paid a different number entirely. On real data that was a 26x
 * gap ($1.80 shown, $47.46 paid). A provider comparing their dashboard against
 * their bank statement would have found it before we did, and it would have
 * been a support ticket rather than a bug report.
 */
/** Cents to a display string in the right currency — "A$50.00", not "50". */
function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'narrowSymbol',
  }).format(cents / 100);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid Authorization header' }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const user = await prisma.user.findUnique({ where: { apiKey } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }
    if (user.role !== 'provider' && user.role !== 'admin') {
      return NextResponse.json({ error: 'Only providers can access this endpoint' }, { status: 403 });
    }

    const agents = await prisma.agent.findMany({
      where: { providerId: user.id },
      select: { id: true, status: true, totalCalls: true, currentScore: true, modelTier: true, native: true },
    });

    const totalAgents = agents.length;
    const activeAgents = agents.filter((a) => a.status === 'active').length;
    const pendingAgents = agents.filter((a) => a.status === 'pending' || a.status === 'benchmarking').length;
    const suspendedAgents = agents.filter((a) => a.status === 'suspended').length;
    const totalCalls = agents.reduce((sum, a) => sum + a.totalCalls, 0);

    const activeWithScore = agents.filter((a) => a.status === 'active' && a.currentScore != null);
    const avgScore =
      activeWithScore.length > 0
        ? activeWithScore.reduce((sum, a) => sum + (a.currentScore ?? 0), 0) / activeWithScore.length
        : null;

    // ── Earnings ──────────────────────────────────────────────────────────
    const periodKey = currentPeriodKey();
    const estimate = await estimateProviderShare(user.id, periodKey);
    const currency = estimate.currency ?? PAYOUT_CURRENCY;

    // Everything actually transferred, ever.
    const paidAgg = await prisma.payout.aggregate({
      where: { providerId: user.id, status: 'paid' },
      _sum: { providerShareCents: true },
    });
    const paidToDateCents = paidAgg._sum.providerShareCents ?? 0;

    // Weighted successful calls across this provider's agents, one query
    // rather than one per agent — the previous version issued a query per
    // agent on every dashboard load.
    const grouped = await prisma.apiCall.groupBy({
      by: ['agentId'],
      where: { agentId: { in: agents.map((a) => a.id) }, status: 'success' },
      _sum: { creditsConsumed: true },
      _count: { _all: true },
    });
    const weightedCalls = grouped.reduce((sum, g) => sum + (g._sum.creditsConsumed ?? 0), 0);
    const successfulCalls = grouped.reduce((sum, g) => sum + g._count._all, 0);

    return NextResponse.json({
      totalAgents,
      activeAgents,
      pendingAgents,
      suspendedAgents,
      totalCalls,
      successfulCalls,
      weightedCalls,
      avgScore: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
      earnings: {
        periodKey,
        // This period, from the payout engine's own maths.
        pendingGrossCents: estimate.grossCents,
        pendingProviderShareCents: estimate.shareCents,
        reserveWithheldCents: Math.max(0, estimate.grossCents - estimate.shareCents),
        // Owed from earlier periods that fell short of the minimum. Shown so a
        // provider under the threshold can see the total climbing rather than
        // reading "below minimum" three months running and assuming it is lost.
        carriedInCents: estimate.carriedInCents,
        payableCents: estimate.payableCents,
        sharePct: estimate.sharePct,
        belowMinimum: estimate.belowMinimum,
        minimumCents: MIN_PAYOUT_THRESHOLD_CENTS,
        // Actually transferred, ever.
        paidToDateCents,
        lifetimeProviderShareCents: paidToDateCents + estimate.payableCents,
        currency,
        ...(estimate.reason ? { note: estimate.reason } : {}),
        basis:
          'Earnings are a share of subscription revenue for the current month, weighted by your usage and agent ratings. ' +
          `Payouts transfer once your balance reaches the ${formatMoney(MIN_PAYOUT_THRESHOLD_CENTS, currency)} minimum. ` +
          'Anything below that carries forward and is added to the next month — it is never forfeited.',
      },
      // Legacy field kept for existing UI callers — total currently payable,
      // including anything carried forward from earlier periods.
      totalRevenue: estimate.payableCents,
    });
  } catch (error) {
    console.error('[GET /api/provider/stats]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
