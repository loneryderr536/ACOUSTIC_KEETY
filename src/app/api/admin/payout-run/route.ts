import { NextRequest, NextResponse } from 'next/server';
import { runMonthlyPayout } from '@/stripe/monthly-payout';
import { isValidPeriodKey } from '@/stripe/period';

/**
 * POST /api/admin/payout-run   { "periodKey": "2026-07", "confirm": true }
 *
 * The monthly revenue-pool payout, ported from the standalone service's
 * `admin.js` + `payoutService.js`.
 *
 * ⚠️ DRY RUN BY DEFAULT. This engine and POST /api/admin/payouts (the rolling
 * per-provider engine that is live today) both write to the same `Payout`
 * table and both create Stripe transfers. Running both against one period pays
 * every provider twice. Until one of them is retired, moving real money from
 * here requires `"confirm": true` in the body — a forgotten flag costs you a
 * report, not a double payout.
 *
 * The two engines also disagree by roughly 2x: this one splits revenue billed,
 * the rolling one pays on credits actually consumed. A dry run here is the
 * cheapest way to see that gap against your own numbers before choosing.
 *
 * Auth: `x-admin-secret: <BENCHMARK_CRON_SECRET>`. The standalone service used
 * an `x-admin-key: <ADMIN_API_KEY>` header; changed so every admin endpoint in
 * this repo is protected by the same token rather than adding a second secret.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (!process.env.BENCHMARK_CRON_SECRET || secret !== process.env.BENCHMARK_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { periodKey?: string; confirm?: boolean; allowOpenPeriod?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    // fall through to the validation below
  }

  const periodKey = body.periodKey;
  if (!periodKey) {
    return NextResponse.json({ error: 'periodKey is required, e.g. "2026-07"' }, { status: 400 });
  }
  if (!isValidPeriodKey(periodKey)) {
    return NextResponse.json(
      { error: `Invalid periodKey "${periodKey}" — expected "YYYY-MM", e.g. "2026-07"` },
      { status: 400 },
    );
  }

  const dryRun = body.confirm !== true;

  // Paying out a month that has not finished is almost always a mistake — see
  // the guard in monthly-payout.ts. It stays possible, but only when asked for
  // by name, and never as a side effect of confirming.
  const allowOpenPeriod = body.allowOpenPeriod === true;

  try {
    const summary = await runMonthlyPayout(periodKey, { dryRun, allowOpenPeriod });
    return NextResponse.json({
      ...summary,
      ...(dryRun
        ? { notice: 'DRY RUN — nothing was written and no transfer was sent. Pass "confirm": true to move money.' }
        : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[stripe] payout-run failed:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
