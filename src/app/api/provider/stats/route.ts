import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MODEL_TIER_WEIGHTS } from '@/lib/plans';
import { PROVIDER_SHARE, CENTS_PER_CREDIT, getLastReconciledBoundary } from '@/lib/payouts';

/* ------------------------------------------------------------------ */
/*  GET /api/provider/stats — aggregate stats for provider's agents    */
/* ------------------------------------------------------------------ */
export async function GET(request: NextRequest) {
  try {
    // Authenticate via Bearer token
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

    // Fetch all agents owned by this provider
    const agents = await prisma.agent.findMany({
      where: { providerId: user.id },
      select: {
        id: true,
        status: true,
        totalCalls: true,
        currentScore: true,
        modelTier: true,
      },
    });

    const totalAgents = agents.length;
    const activeAgents = agents.filter((a) => a.status === 'active').length;
    const pendingAgents = agents.filter(
      (a) => a.status === 'pending' || a.status === 'benchmarking',
    ).length;
    const suspendedAgents = agents.filter((a) => a.status === 'suspended').length;
    const totalCalls = agents.reduce((sum, a) => sum + a.totalCalls, 0);

    // Average score across active agents with a score
    const activeWithScore = agents.filter(
      (a) => a.status === 'active' && a.currentScore != null,
    );
    const avgScore =
      activeWithScore.length > 0
        ? activeWithScore.reduce((sum, a) => sum + (a.currentScore ?? 0), 0) /
          activeWithScore.length
        : null;

    // Earnings calculation — only successful calls count, and only ones
    // since the last PAID payout (so the provider sees what's accumulating
    // toward their next payout, not an ever-growing all-time total).
    // Previously-paid earnings are available on /api/provider/payouts.
    const agentIds = agents.map((a) => a.id);
    let pendingGrossCents = 0;
    let lifetimeGrossCents = 0;
    let pendingSuccessfulCalls = 0;
    let weightedCalls = 0;

    const lastPaidBoundary = await getLastReconciledBoundary(user.id);

    if (agentIds.length > 0) {
      // Unpaid earnings window (post last paid payout). Authoritative
      // source is ApiCall.creditsConsumed — snapshotted at call time.
      const pendingAgg = await prisma.apiCall.aggregate({
        where: {
          agentId: { in: agentIds },
          status: 'success',
          ...(lastPaidBoundary ? { createdAt: { gt: lastPaidBoundary } } : {}),
        },
        _sum: { creditsConsumed: true },
        _count: { _all: true },
      });
      const pendingCredits = pendingAgg._sum.creditsConsumed ?? 0;
      pendingGrossCents = pendingCredits * CENTS_PER_CREDIT;
      pendingSuccessfulCalls = pendingAgg._count._all;

      // Lifetime gross — "you've earned $X ever"
      const lifetimeAgg = await prisma.apiCall.aggregate({
        where: { agentId: { in: agentIds }, status: 'success' },
        _sum: { creditsConsumed: true },
      });
      const lifetimeCredits = lifetimeAgg._sum.creditsConsumed ?? 0;
      lifetimeGrossCents = lifetimeCredits * CENTS_PER_CREDIT;

      // weightedCalls stays as (calls × modelTier weight), same as
      // creditsConsumed when tier hasn't changed. Exposed for UI labels.
      for (const a of agents) {
        const weight = MODEL_TIER_WEIGHTS[a.modelTier ?? 'unknown'] ?? 1;
        const agentSuccessfulCalls = await prisma.apiCall.count({
          where: { agentId: a.id, status: 'success' },
        });
        weightedCalls += agentSuccessfulCalls * weight;
      }
    }

    // Pending payout (what will transfer on the next run if above threshold)
    const pendingProviderShareCents = Math.floor(pendingGrossCents * PROVIDER_SHARE);

    // Lifetime earned (for "you have earned $X so far" copy)
    const lifetimeProviderShareCents = Math.floor(lifetimeGrossCents * PROVIDER_SHARE);

    return NextResponse.json({
      totalAgents,
      activeAgents,
      pendingAgents,
      suspendedAgents,
      totalCalls,
      successfulCalls: pendingSuccessfulCalls,
      weightedCalls,
      avgScore: avgScore != null ? Math.round(avgScore * 100) / 100 : null,
      earnings: {
        pendingGrossCents,
        pendingProviderShareCents,
        lifetimeGrossCents,
        lifetimeProviderShareCents,
        lastPaidBoundary,
        currency: 'usd',
        note:
          'Pending earnings are unpaid successful-call revenue since your last payout. Payouts process monthly via Stripe Connect once pending share reaches the $50 minimum. See provider terms for the full fee schedule.',
      },
      // Legacy field kept for existing UI callers — now shows PENDING share only.
      totalRevenue: pendingProviderShareCents,
    });
  } catch (error) {
    console.error('[GET /api/provider/stats]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
