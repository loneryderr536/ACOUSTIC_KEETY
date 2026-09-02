import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runBenchmark } from '@/lib/benchmark';

/* ------------------------------------------------------------------ */
/*  POST /api/benchmark — trigger benchmark                            */
/* ------------------------------------------------------------------ */
export async function POST(request: NextRequest) {
  try {
    const cronSecret = process.env.BENCHMARK_CRON_SECRET;
    const benchmarkSecretHeader = request.headers.get('x-benchmark-secret');

    // ---- Path A: Cron / system trigger (benchmark all pending agents) ----
    if (benchmarkSecretHeader && cronSecret && benchmarkSecretHeader === cronSecret) {
      const pendingAgents = await prisma.agent.findMany({
        where: { status: 'pending' },
      });

      if (pendingAgents.length === 0) {
        return NextResponse.json({
          message: 'No pending agents to benchmark',
          count: 0,
        });
      }

      const results = await Promise.allSettled(
        pendingAgents.map(async (agent) => {
          const result = await runBenchmark(agent.id);
          return { agentId: agent.id, slug: agent.slug, ...result };
        }),
      );

      const summary = results.map((r) =>
        r.status === 'fulfilled'
          ? { ...r.value, ok: true }
          : { ok: false, error: String(r.reason) },
      );

      return NextResponse.json({
        message: `Benchmarked ${pendingAgents.length} agent(s)`,
        count: pendingAgents.length,
        results: summary,
      });
    }

    // ---- Path B: Provider-triggered benchmark for their own agent ----
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

    const body = await request.json();
    const agentId = body.agentId as string | undefined;

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 },
      );
    }

    // Verify the user owns the agent
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    if (agent.providerId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not own this agent' },
        { status: 403 },
      );
    }

    const result = await runBenchmark(agent.id);

    const updated = await prisma.agent.findUnique({ where: { id: agent.id } });

    return NextResponse.json({
      agentId: agent.id,
      slug: agent.slug,
      score: result.compositeScore,
      status: updated?.status,
      message: 'Benchmark complete',
    });
  } catch (error) {
    console.error('[POST /api/benchmark]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
