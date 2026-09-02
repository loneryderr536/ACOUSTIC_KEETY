import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/* ------------------------------------------------------------------ */
/*  GET /api/provider/agents — list agents owned by the provider       */
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

    const agents = await prisma.agent.findMany({
      where: { providerId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        benchmarks: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
        healthChecks: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    // Enrich each agent with summary health status and call counts
    const enriched = agents.map(agent => ({
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      category: agent.category,
      status: agent.status,
      endpointUrl: agent.endpointUrl,
      currentScore: agent.currentScore,
      latencyP50: agent.latencyP50,
      latencyP95: agent.latencyP95,
      uptime: agent.uptime,
      errorRate: agent.errorRate,
      totalCalls: agent.totalCalls,
      rating: agent.rating,
      reviewCount: agent.reviewCount,
      pricePerCall: agent.pricePerCall,
      benchmarks: agent.benchmarks,
      healthChecks: agent.healthChecks,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    }));

    return NextResponse.json({ agents: enriched, total: enriched.length });
  } catch (error) {
    console.error('[GET /api/provider/agents]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
