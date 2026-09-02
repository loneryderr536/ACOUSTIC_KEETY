import { NextRequest, NextResponse } from 'next/server';
import {
  startOrchestrator,
  stopOrchestrator,
  getOrchestratorStatus,
} from '@/lib/orchestrator';

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.BENCHMARK_CRON_SECRET;
  const authHeader = request.headers.get('authorization');

  if (
    !cronSecret ||
    !authHeader?.startsWith('Bearer ') ||
    authHeader.slice(7) !== cronSecret
  ) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// GET /api/orchestrator — return orchestrator status
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = getOrchestratorStatus();

    return NextResponse.json(status);
  } catch (error) {
    console.error('[GET /api/orchestrator]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST /api/orchestrator — start or stop the orchestrator
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const action = body?.action;

    if (action !== 'start' && action !== 'stop') {
      return NextResponse.json(
        { error: 'Invalid action. Must be "start" or "stop".' },
        { status: 400 },
      );
    }

    if (action === 'start') {
      startOrchestrator();
    } else {
      stopOrchestrator();
    }

    const status = getOrchestratorStatus();

    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    console.error('[POST /api/orchestrator]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
