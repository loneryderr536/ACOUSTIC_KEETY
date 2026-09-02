let initialized = false;
let initPromise: Promise<void> | null = null;

export function ensureOrchestrator() {
  if (initialized) return;
  if (typeof window !== 'undefined') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  if (!initPromise) {
    initPromise = startOrchestratorAsync();
  }
}

async function startOrchestratorAsync() {
  await new Promise<void>((resolve) => process.nextTick(resolve));

  try {
    const { startOrchestrator, getOrchestratorStatus } = await import('./orchestrator');
    const status = getOrchestratorStatus();
    if (!status.running) {
      startOrchestrator();
      console.log('[bootstrap] Orchestrator auto-started');
    }
    initialized = true;
  } catch (err) {
    console.error('[bootstrap] Failed to start orchestrator:', err);
    initPromise = null;
  }
}
