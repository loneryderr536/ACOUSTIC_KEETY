import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedisClient } from '@/lib/redis';
import { getOrchestratorStatus } from '@/lib/orchestrator';

export async function GET() {
  let dbOk = false;
  let redisOk = false;
  let activeAgents = 0;
  let totalAgents = 0;

  try {
    const result = await prisma.$queryRaw`SELECT 1`;
    dbOk = !!result;
  } catch {}

  try {
    const redis = getRedisClient();
    if (redis) {
      const pong = await redis.ping();
      redisOk = pong === 'PONG';
    }
  } catch {}

  try {
    [activeAgents, totalAgents] = await Promise.all([
      prisma.agent.count({ where: { status: 'active' } }),
      prisma.agent.count(),
    ]);
  } catch {}

  const orchestrator = getOrchestratorStatus();

  return NextResponse.json({
    status: dbOk && redisOk ? 'operational' : 'degraded',
    database: dbOk,
    redis: redisOk,
    agents: { active: activeAgents, total: totalAgents },
    orchestrator: { running: orchestrator.running },
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
