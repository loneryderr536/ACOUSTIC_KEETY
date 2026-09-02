import cron, { type ScheduledTask } from 'node-cron';
import { checkAllAgents } from './health';
import { runBenchmark } from './benchmark';
import { scanInput } from './security';
import { prisma } from './prisma';
import { leaderboard } from './redis';
import { dailyReplenishment } from './usage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrchestratorJob {
  name: string;
  schedule: string;
  lastRun: Date | null;
  task: ScheduledTask | null;
}

interface OrchestratorStatus {
  running: boolean;
  jobs: {
    name: string;
    schedule: string;
    lastRun: Date | null;
    nextRun: string;
  }[];
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

const jobs: Map<string, OrchestratorJob> = new Map();
let running = false;

// ---------------------------------------------------------------------------
// Job definitions
// ---------------------------------------------------------------------------

/**
 * Health checks — every 5 minutes.
 * Calls checkAllAgents() and logs results.
 */
async function healthCheckJob() {
  console.log('[orchestrator] Starting health checks...');
  try {
    const results = await checkAllAgents();
    const unhealthy = results.filter(
      (r) => r.outcome && 'checkStatus' in r.outcome && r.outcome.checkStatus !== 'healthy',
    );
    console.log(
      `[orchestrator] Health checks complete: ${results.length} agents checked, ${unhealthy.length} unhealthy`,
    );
  } catch (err) {
    console.error('[orchestrator] Health check job failed:', err);
  }
}

/**
 * Benchmark pending agents — every hour.
 * Finds agents with status 'pending' and benchmarks them one at a time.
 */
async function benchmarkPendingJob() {
  console.log('[orchestrator] Starting benchmark of pending agents...');
  try {
    const pendingAgents = await prisma.agent.findMany({
      where: { status: 'pending' },
      select: { id: true, slug: true },
      orderBy: { createdAt: 'asc' },
    });

    if (pendingAgents.length === 0) {
      console.log('[orchestrator] No pending agents to benchmark');
      return;
    }

    console.log(
      `[orchestrator] Found ${pendingAgents.length} pending agent(s)`,
    );

    // Run one at a time to avoid overloading
    for (const agent of pendingAgents) {
      try {
        console.log(`[orchestrator] Benchmarking agent: ${agent.slug}`);
        await runBenchmark(agent.id);
        console.log(
          `[orchestrator] Benchmark complete for agent: ${agent.slug}`,
        );
      } catch (err) {
        console.error(
          `[orchestrator] Benchmark failed for agent ${agent.slug}:`,
          err,
        );
      }
    }

    console.log('[orchestrator] Benchmark pending job complete');
  } catch (err) {
    console.error('[orchestrator] Benchmark pending job failed:', err);
  }
}

/**
 * Leaderboard refresh — every 15 minutes.
 * Recalculates ranks for all active agents and updates Redis.
 */
async function leaderboardRefreshJob() {
  console.log('[orchestrator] Starting leaderboard refresh...');
  try {
    const activeAgents = await prisma.agent.findMany({
      where: { status: 'active', currentScore: { gt: 0 } },
      select: { slug: true, category: true, currentScore: true },
      orderBy: { currentScore: 'desc' },
    });

    let updated = 0;
    for (const agent of activeAgents) {
      try {
        await leaderboard.updateScore(
          agent.category,
          agent.slug,
          agent.currentScore ?? 0,
        );
        updated++;
      } catch (err) {
        console.error(
          `[orchestrator] Failed to update leaderboard for ${agent.slug}:`,
          err,
        );
      }
    }

    console.log(
      `[orchestrator] Leaderboard refresh complete: ${updated}/${activeAgents.length} agents updated`,
    );
  } catch (err) {
    console.error('[orchestrator] Leaderboard refresh job failed:', err);
  }
}

/**
 * Monthly usage reset — 1st of each month at midnight.
 * Resets callsUsed to 0 for all users so rate limits refresh.
 */
async function monthlyUsageResetJob() {
  console.log('[orchestrator] Starting monthly usage reset...');
  try {
    const result = await prisma.user.updateMany({
      data: { callsUsed: 0 },
    });
    console.log(`[orchestrator] Monthly usage reset complete: ${result.count} users reset`);
  } catch (err) {
    console.error('[orchestrator] Monthly usage reset failed:', err);
  }
}

/**
 * Daily replenishment — midnight UTC.
 * Tops up callsBalance for paid users, capped at their plan's callsLimit.
 */
async function dailyReplenishmentJob() {
  console.log('[orchestrator] Starting daily replenishment...');
  try {
    const result = await dailyReplenishment();
    console.log(
      `[orchestrator] Daily replenishment complete: ${result.replenished}/${result.total} users topped up`,
    );
  } catch (err) {
    console.error('[orchestrator] Daily replenishment failed:', err);
  }
}

/**
 * Security scan — every 6 hours.
 * Re-scans all active agents' endpoints for response anomalies.
 * Currently performs a health check and basic response pattern analysis.
 */
async function securityScanJob() {
  console.log('[orchestrator] Starting security scan...');
  try {
    const activeAgents = await prisma.agent.findMany({
      where: { status: { in: ['active', 'degraded'] } },
      select: { id: true, slug: true, endpointUrl: true },
    });

    let flagged = 0;

    for (const agent of activeAgents) {
      try {
        // Basic health probe
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000);

        const response = await fetch(
          new URL('/health', agent.endpointUrl).href,
          { method: 'GET', signal: controller.signal },
        );
        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json().catch(() => null);
          if (data) {
            // Scan the response for injection patterns
            const scanResult = scanInput(data);
            if (!scanResult.safe) {
              console.warn(
                `[orchestrator] Security flag for ${agent.slug}: riskScore=${scanResult.riskScore}`,
                scanResult.findings,
              );
              flagged++;
            }
          }
        }
      } catch {
        // Health check failure is handled by the health check job, not here
      }
    }

    console.log(
      `[orchestrator] Security scan complete: ${activeAgents.length} agents scanned, ${flagged} flagged`,
    );
  } catch (err) {
    console.error('[orchestrator] Security scan job failed:', err);
  }
}

// ---------------------------------------------------------------------------
// Orchestrator control
// ---------------------------------------------------------------------------

/**
 * Start all background cron jobs.
 */
export function startOrchestrator(): void {
  if (running) {
    console.log('[orchestrator] Already running');
    return;
  }

  console.log('[orchestrator] Starting orchestrator...');

  // Health checks — every 5 minutes
  const healthTask = cron.schedule('*/5 * * * *', async () => {
    const job = jobs.get('health-check')!;
    await healthCheckJob();
    job.lastRun = new Date();
  });
  jobs.set('health-check', {
    name: 'health-check',
    schedule: '*/5 * * * *',
    lastRun: null,
    task: healthTask,
  });

  // Benchmark pending — every hour
  const benchmarkTask = cron.schedule('0 * * * *', async () => {
    const job = jobs.get('benchmark-pending')!;
    await benchmarkPendingJob();
    job.lastRun = new Date();
  });
  jobs.set('benchmark-pending', {
    name: 'benchmark-pending',
    schedule: '0 * * * *',
    lastRun: null,
    task: benchmarkTask,
  });

  // Leaderboard refresh — every 15 minutes
  const leaderboardTask = cron.schedule('*/15 * * * *', async () => {
    const job = jobs.get('leaderboard-refresh')!;
    await leaderboardRefreshJob();
    job.lastRun = new Date();
  });
  jobs.set('leaderboard-refresh', {
    name: 'leaderboard-refresh',
    schedule: '*/15 * * * *',
    lastRun: null,
    task: leaderboardTask,
  });

  // Security scan — every 6 hours
  const securityTask = cron.schedule('0 */6 * * *', async () => {
    const job = jobs.get('security-scan')!;
    await securityScanJob();
    job.lastRun = new Date();
  });
  jobs.set('security-scan', {
    name: 'security-scan',
    schedule: '0 */6 * * *',
    lastRun: null,
    task: securityTask,
  });

  // Monthly usage reset — 1st of each month at midnight
  const usageResetTask = cron.schedule('0 0 1 * *', async () => {
    const job = jobs.get('usage-reset')!;
    await monthlyUsageResetJob();
    job.lastRun = new Date();
  });
  jobs.set('usage-reset', {
    name: 'usage-reset',
    schedule: '0 0 1 * *',
    lastRun: null,
    task: usageResetTask,
  });

  // Daily replenishment — midnight UTC
  const dailyReplenishTask = cron.schedule('0 0 * * *', async () => {
    const job = jobs.get('daily-replenishment')!;
    await dailyReplenishmentJob();
    job.lastRun = new Date();
  });
  jobs.set('daily-replenishment', {
    name: 'daily-replenishment',
    schedule: '0 0 * * *',
    lastRun: null,
    task: dailyReplenishTask,
  });

  running = true;
  console.log('[orchestrator] All jobs scheduled');
}

/**
 * Stop all background cron jobs.
 */
export function stopOrchestrator(): void {
  if (!running) {
    console.log('[orchestrator] Not running');
    return;
  }

  console.log('[orchestrator] Stopping orchestrator...');

  for (const [, job] of jobs) {
    if (job.task) {
      job.task.stop();
      job.task = null;
    }
  }

  jobs.clear();
  running = false;
  console.log('[orchestrator] All jobs stopped');
}

/**
 * Get the current orchestrator status including all job info.
 */
export function getOrchestratorStatus(): OrchestratorStatus {
  const jobList: OrchestratorStatus['jobs'] = [];

  for (const [, job] of jobs) {
    jobList.push({
      name: job.name,
      schedule: job.schedule,
      lastRun: job.lastRun,
      nextRun: job.schedule, // cron expression serves as next-run indicator
    });
  }

  return { running, jobs: jobList };
}
