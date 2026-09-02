import { NextResponse } from 'next/server';

/**
 * GET /health — liveness probe.
 *
 * Two callers:
 *
 * 1. **The agent health monitor.** `checkAgentHealth` probes an agent with
 *    `new URL('/health', agent.endpointUrl)`, which resolves against the
 *    ORIGIN, not the agent's path. So an agent hosted at
 *    `https://example.com/agents/foo` is probed at `https://example.com/health`.
 *    Locally the seeded agents point at this app's own mock endpoint, so this
 *    route is what makes them read as healthy instead of being demoted to
 *    `degraded` and disappearing from the landing page.
 *
 * 2. **Platform health checks.** Railway and most hosts expect a plain,
 *    unauthenticated liveness path at the root.
 *
 * Deliberately does NOT touch the database. A liveness probe should answer
 * "is this process up", not "is Postgres reachable" — otherwise a brief
 * database blip gets the whole container restarted, which is the opposite of
 * what you want mid-incident.
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'acoustic-kitty',
    timestamp: new Date().toISOString(),
  });
}
