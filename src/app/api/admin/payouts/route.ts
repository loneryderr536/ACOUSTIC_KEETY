import { NextRequest, NextResponse } from 'next/server';
import { runAllPayouts, previewAllPayouts } from '@/lib/payouts';

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

  let body: { dryRun?: boolean; periodEnd?: string; force?: boolean } = {};
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

  // A real preview: same aggregation and same thresholds as the live run,
  // but nothing written and Stripe never called. The previous version returned
  // only a sentence, which answered none of the questions you'd dry-run for.
  if (body.dryRun) {
    const preview = await previewAllPayouts(periodEnd);
    return NextResponse.json({
      ...preview,
      message: 'Dry run — no Stripe Transfers executed, no Payout rows written. Omit dryRun to run for real.',
    });
  }

  // ── RETIRED AS A PAYER (2026-09-02) ─────────────────────────────────────
  //
  // The monthly revenue-pool engine is now the one that moves money:
  //   POST /api/admin/payout-run  { "periodKey": "2026-09", "confirm": true }
  //
  // Both engines write to the same `Payout` table, so running both against one
  // period pays every provider twice. And they disagree by a lot: measured on
  // real data, this one judged a provider to have earned $1.80 where the pool
  // engine said $47.46 — an effective platform take of 97.7% against a
  // published 65/35 split.
  //
  // The aggregation is deliberately kept, not deleted: `previewAllPayouts`
  // above still works, and comparing the two engines on live data is worth
  // being able to do. Only the path that creates Stripe Transfers is closed.
  if (!body.force) {
    return NextResponse.json(
      {
        error: 'This engine no longer sends payouts.',
        use: 'POST /api/admin/payout-run with { "periodKey": "YYYY-MM", "confirm": true }',
        why:
          'The monthly revenue-pool engine is the payer. Running both against the same period would ' +
          'pay providers twice. Pass {"dryRun":true} here for a comparison preview, which still works.',
      },
      { status: 409 },
    );
  }

  try {
    const result = await runAllPayouts(periodEnd);
    return NextResponse.json({
      mode: 'live',
      warning: 'Forced run of the RETIRED rolling engine. Check for duplicate Payout rows against payout-run.',
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
