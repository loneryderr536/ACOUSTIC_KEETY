import { NextRequest, NextResponse } from 'next/server';
import { checkAllAgents } from '@/lib/health';

/* ------------------------------------------------------------------ */
/*  GET /api/cron/health — health check cron                           */
/* ------------------------------------------------------------------ */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.BENCHMARK_CRON_SECRET;
    const authHeader = request.headers.get('authorization');

    if (
      !cronSecret ||
      !authHeader?.startsWith('Bearer ') ||
      authHeader.slice(7) !== cronSecret
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await checkAllAgents();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[GET /api/cron/health]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
