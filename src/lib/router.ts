import { prisma } from './prisma';
import { decrypt, isEncrypted } from './crypto';
import { getPlanConfig } from './plans';

// ---------------------------------------------------------------------------
// Circuit Breaker
// ---------------------------------------------------------------------------

const circuitBreaker = new Map<string, { failures: number; lastFailure: number }>();
const CIRCUIT_THRESHOLD = 3;
const CIRCUIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function recordFailure(agentId: string) {
  const now = Date.now();
  const entry = circuitBreaker.get(agentId);
  if (entry && now - entry.lastFailure < CIRCUIT_WINDOW_MS) {
    entry.failures++;
    entry.lastFailure = now;
  } else {
    circuitBreaker.set(agentId, { failures: 1, lastFailure: now });
  }
}

export function isCircuitOpen(agentId: string): boolean {
  const entry = circuitBreaker.get(agentId);
  if (!entry) return false;
  if (Date.now() - entry.lastFailure > CIRCUIT_WINDOW_MS) {
    circuitBreaker.delete(agentId);
    return false;
  }
  return entry.failures >= CIRCUIT_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RouteRequest {
  agent?: string;
  category?: string;
  routing?: 'performance' | 'latency' | 'cost' | 'specific';
  subscriberPlan?: string;
}

export interface ResolvedAgent {
  id: string;
  slug: string;
  name: string;
  endpointUrl: string;
  authType: string;
  authToken: string | null;
  pricePerCall: number;
  modelTier: string;
  fallbackAgentIds: string[];
}

// ---------------------------------------------------------------------------
// Agent Resolution
// ---------------------------------------------------------------------------

function decryptToken(token: string | null): string | null {
  if (!token) return null;
  try {
    return isEncrypted(token) ? decrypt(token) : token;
  } catch {
    console.error('[router] Failed to decrypt agent token');
    return token;
  }
}

export async function resolveAgent(req: RouteRequest): Promise<ResolvedAgent> {
  const strategy = req.routing ?? 'performance';

  // Specific agent requested by slug
  if (strategy === 'specific' || req.agent) {
    if (!req.agent) throw new Error('Agent slug required for specific routing');

    const agent = await prisma.agent.findUnique({
      where: { slug: req.agent },
    });
    if (!agent) throw new Error(`Agent not found: ${req.agent}`);
    if (agent.status !== 'active' && agent.status !== 'degraded') {
      throw new Error(`Agent "${req.agent}" is not available (status: ${agent.status})`);
    }
    if (isCircuitOpen(agent.id)) {
      throw new Error(`Agent "${req.agent}" is temporarily unavailable (circuit open)`);
    }

    // Plan tier gating: free (Recruit) subscribers can only call Haiku-tier
    // agents. Paid tiers get full access.
    const planCfg = getPlanConfig(req.subscriberPlan ?? 'recruit');
    if (planCfg.allowedModelTiers && !planCfg.allowedModelTiers.includes(agent.modelTier ?? 'unknown')) {
      throw new Error(
        `Your plan doesn't include ${agent.modelTier}-tier agents. Upgrade to Field Agent or higher to access "${req.agent}".`,
      );
    }

    const fallbacks = await prisma.agent.findMany({
      where: {
        category: agent.category,
        status: 'active',
        id: { not: agent.id },
      },
      orderBy: { currentScore: 'desc' },
      take: 3,
      select: { id: true },
    });

    return {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      endpointUrl: agent.endpointUrl,
      authType: agent.authType,
      authToken: decryptToken(agent.authToken),
      pricePerCall: agent.pricePerCall,
      modelTier: agent.modelTier,
      fallbackAgentIds: fallbacks.map((f) => f.id),
    };
  }

  // Strategy-based routing
  const where: Record<string, unknown> = {
    status: { in: ['active', 'degraded'] },
  };
  if (req.category) where.category = req.category;

  let orderBy: Record<string, string>;
  switch (strategy) {
    case 'latency':
      orderBy = { latencyP50: 'asc' };
      break;
    case 'cost':
      orderBy = { pricePerCall: 'asc' };
      break;
    case 'performance':
    default:
      orderBy = { currentScore: 'desc' };
      break;
  }

  const agents = await prisma.agent.findMany({
    where,
    orderBy,
    take: 8,
  });

  if (agents.length === 0) {
    throw new Error('No available agents found for the given criteria');
  }

  // Plan tier gating — restrict free subscribers to allowed model tiers.
  // Paid tiers (allowedModelTiers === null) get unrestricted access.
  const planCfg = getPlanConfig(req.subscriberPlan ?? 'recruit');
  let filtered = agents;
  if (planCfg.allowedModelTiers) {
    const allowed = new Set(planCfg.allowedModelTiers);
    filtered = agents.filter((a) => allowed.has(a.modelTier ?? 'unknown'));
    if (filtered.length === 0) {
      throw new Error(
        `No agents available on your plan tier. Upgrade to Field Agent or higher for access to Standard and Premium agents.`,
      );
    }
  }

  // Circuit breaker filtering
  const available = filtered.filter((a) => !isCircuitOpen(a.id));
  if (available.length === 0) {
    throw new Error('No agents available (all circuit-broken or filtered by plan tier)');
  }

  const [primary, ...rest] = available;

  return {
    id: primary.id,
    slug: primary.slug,
    name: primary.name,
    endpointUrl: primary.endpointUrl,
    authType: primary.authType,
    authToken: decryptToken(primary.authToken),
    pricePerCall: primary.pricePerCall,
    modelTier: primary.modelTier,
    fallbackAgentIds: rest.map((a) => a.id),
  };
}

// ---------------------------------------------------------------------------
// Agent Proxy
// ---------------------------------------------------------------------------

export interface ProxyResult {
  data: unknown;
  latencyMs: number;
  status: 'success' | 'error' | 'timeout';
}

export async function proxyToAgent(
  endpointUrl: string,
  authType: string,
  authToken: string | null,
  payload: unknown,
  agentId?: string,
): Promise<ProxyResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    switch (authType) {
      case 'bearer':
        headers['Authorization'] = `Bearer ${authToken}`;
        break;
      case 'api_key':
        headers['X-API-Key'] = authToken;
        break;
    }
  }

  const start = Date.now();

  try {
    // Level 2 contract: POST to /tasks endpoint
    const taskUrl = `${endpointUrl.replace(/\/+$/, '')}/tasks`;
    const response = await fetch(taskUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const latencyMs = Date.now() - start;
    const data = await response.json();

    if (!response.ok && agentId) {
      recordFailure(agentId);
    }

    return {
      data,
      latencyMs,
      status: response.ok ? 'success' : 'error',
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;

    if (agentId) recordFailure(agentId);

    if (err instanceof DOMException && err.name === 'AbortError') {
      return { data: null, latencyMs, status: 'timeout' };
    }

    console.error('[proxyToAgent]', err);
    return {
      data: { error: 'Agent request failed' },
      latencyMs,
      status: 'error',
    };
  } finally {
    clearTimeout(timeout);
  }
}
