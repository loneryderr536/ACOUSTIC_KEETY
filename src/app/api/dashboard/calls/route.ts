import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/* ------------------------------------------------------------------ */
/*  GET /api/dashboard/calls — paginated subscriber call history       */
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

    // Parse query params
    const url = request.nextUrl;
    const limit = Math.min(Math.max(1, Number(url.searchParams.get('limit') ?? 20)), 100);
    const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0));
    const statusFilter = url.searchParams.get('status') ?? undefined;

    // Build where clause
    const where: Record<string, unknown> = { subscriberId: user.id };
    if (statusFilter && ['success', 'error', 'timeout'].includes(statusFilter)) {
      where.status = statusFilter;
    }

    const [calls, total] = await Promise.all([
      prisma.apiCall.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          agent: {
            select: { slug: true, name: true },
          },
        },
      }),
      prisma.apiCall.count({ where }),
    ]);

    const formattedCalls = calls.map(call => ({
      callId: call.callId,
      agentSlug: call.agent.slug,
      agentName: call.agent.name,
      routingStrategy: call.routingStrategy,
      latencyMs: call.latencyMs,
      status: call.status,
      costCents: call.costCents,
      createdAt: call.createdAt,
    }));

    return NextResponse.json({
      calls: formattedCalls,
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[GET /api/dashboard/calls]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
