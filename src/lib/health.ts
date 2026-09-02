import { prisma } from './prisma';

// ---------------------------------------------------------------------------
// Single agent health check
// ---------------------------------------------------------------------------

/**
 * Check an agent's health by GETting its /health endpoint (10 s timeout).
 *
 * Records a HealthCheck row and adjusts the agent's status:
 * - 10+ recent failures & active   -> suspend
 * - 3+  recent failures & active   -> degrade
 * - 0   recent failures & degraded -> restore to active
 */
export async function checkAgentHealth(agentId: string) {
  const agent = await prisma.agent.findUniqueOrThrow({
    where: { id: agentId },
  });

  // Derive the health endpoint from the agent's base URL
  const healthUrl = new URL('/health', agent.endpointUrl).href;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let checkStatus: 'healthy' | 'unhealthy' | 'timeout';
  let latencyMs: number | null = null;

  const start = Date.now();

  try {
    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    latencyMs = Date.now() - start;
    checkStatus = response.ok ? 'healthy' : 'unhealthy';
  } catch (err: unknown) {
    latencyMs = Date.now() - start;

    if (err instanceof DOMException && err.name === 'AbortError') {
      checkStatus = 'timeout';
    } else {
      checkStatus = 'unhealthy';
    }
  } finally {
    clearTimeout(timeout);
  }

  // Record the health check
  await prisma.healthCheck.create({
    data: {
      agentId,
      status: checkStatus,
      latencyMs,
    },
  });

  // Fetch the last 10 health checks for status transitions
  const recentChecks = await prisma.healthCheck.findMany({
    where: { agentId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { status: true },
  });

  const recentFailures = recentChecks.filter(
    (c) => c.status !== 'healthy',
  ).length;

  // Status transition logic
  if (recentFailures >= 10 && agent.status === 'active') {
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: 'suspended' },
    });
  } else if (recentFailures >= 3 && agent.status === 'active') {
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: 'degraded' },
    });
  } else if (recentFailures === 0 && agent.status === 'degraded') {
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: 'active' },
    });
  }

  return { checkStatus, latencyMs, recentFailures };
}

// ---------------------------------------------------------------------------
// Bulk health check
// ---------------------------------------------------------------------------

/**
 * Run health checks for all active or degraded agents in parallel.
 */
export async function checkAllAgents() {
  const agents = await prisma.agent.findMany({
    where: { status: { in: ['active', 'degraded'] } },
    select: { id: true },
  });

  const results = await Promise.allSettled(
    agents.map((agent) => checkAgentHealth(agent.id)),
  );

  return results.map((result, index) => ({
    agentId: agents[index].id,
    outcome: result.status === 'fulfilled' ? result.value : { error: result.reason instanceof Error ? result.reason.message : String(result.reason) },
  }));
}
