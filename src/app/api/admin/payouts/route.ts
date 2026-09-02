import { NextRequest, NextResponse } from 'next/server';
import { runAllPayouts } from '@/lib/payouts';

/**
 * POST /api/admin/payouts
 *
 * Runs the provider payout cycle. Aggregates every provider's unpaid
 * successful-call earnings, applies the 65% provider share, creates
 * Stripe Transfers for providers above the $50 minimum threshold with an
 * onboarded Connect account, and writes Payout rows (paid / skipped /
 * failed) for every provider touched.
 *
 * Auth: pass `x-admin-secret: <BENCHMARK_CRON_SECRET>` — same token
 * protecting other admin endpoints.
 *
 * Safety:
 *   - dry-run defaults to OFF; pass {"dryRun": true} to preview without
 *     hitting Stripe.
 *   - periodEnd defaults to now, but can be overridden to reprocess a
 *     historical window (use with care — duplicates are blocked by the
 *     (providerId, periodEnd) unique constraint but you'll get "skipped"
 *     rows).
 *   - Idempotency: every Stripe Transfer is sent with an idempotencyKey
 *     derived from the Payout row id, so re-runs of the same window
 *     will not double-pay.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (!process.env.BENCHMARK_CRON_SECRET || secret !== process.env.BENCHMARK_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { dryRun?: boolean; periodEnd?: string } = {};
  try {
    body = await request.json();
  } catch {
    // no body / non-JSON body is fine — use defaults
  }

  const periodEnd = body.periodEnd ? new Date(body.periodEnd) : new Date();
  if (isNaN(periodEnd.getTime())) {
    return NextResponse.json(
      { error: 'Invalid periodEnd; pass an ISO-8601 string' },
      { status: 400 },
    );
  }

  if (body.dryRun) {
    return NextResponse.json({
      mode: 'dry-run',
      periodEnd,
      message:
        'Dry-run mode — no Stripe Transfers executed, no Payout rows written. Call without dryRun:true to actually run.',
    });
  }

  try {
    const result = await runAllPayouts(periodEnd);
    return NextResponse.json({
      mode: 'live',
      ...result,
    });
  } catch (err) {
    console.error('[POST /api/admin/payouts]', err);
    return NextResponse.json(
      { error: 'Payout runner failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/payouts
 *
 * Admin-only list of recent payouts for debugging.
 */
export async function GET(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (!process.env.BENCHMARK_CRON_SECRET || secret !== process.env.BENCHMARK_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { prisma } = await import('@/lib/prisma');
  const rows = await prisma.payout.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { provider: { select: { email: true } } },
  });

  return NextResponse.json({ payouts: rows });
}
