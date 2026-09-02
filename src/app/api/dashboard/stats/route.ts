import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getPlanConfig } from '@/lib/plans';

/* ------------------------------------------------------------------ */
/*  GET /api/dashboard/stats — subscriber usage stats                  */
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

    const callsRemaining = Math.max(0, user.callsLimit - user.callsUsed);
    const percentUsed = user.callsLimit > 0
      ? Math.round((user.callsUsed / user.callsLimit) * 10000) / 100
      : 0;

    // Fetch last 10 API calls with agent info
    const recentCalls = await prisma.apiCall.findMany({
      where: { subscriberId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        agent: {
          select: { slug: true, name: true },
        },
      },
    });

    const formattedCalls = recentCalls.map(call => ({
      callId: call.callId,
      agent: call.agent.name,
      agentSlug: call.agent.slug,
      status: call.status,
      latencyMs: call.latencyMs,
      costCents: call.costCents,
      createdAt: call.createdAt,
    }));

    return NextResponse.json({
      plan: user.plan,
      planLabel: getPlanConfig(user.plan).label,
      callsUsed: user.callsUsed,
      callsLimit: user.callsLimit,
      callsBalance: user.callsBalance,
      dailyAllowance: user.dailyAllowance,
      dailyCeiling: user.dailyCeiling,
      callsRemaining,
      percentUsed,
      recentCalls: formattedCalls,
    });
  } catch (error) {
    console.error('[GET /api/dashboard/stats]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
