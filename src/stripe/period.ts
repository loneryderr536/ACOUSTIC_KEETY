/**
 * Payout periods are calendar months in UTC, formatted "YYYY-MM" (e.g. "2026-07").
 *
 * Every writer of a periodKey — usage events, revenue rows, payout rows — has to
 * agree on this format and this timezone, or runMonthlyPayout won't match them up.
 *
 * Ported from the standalone service. That repo had this function twice
 * (`src/lib/period.js` and `src/utils/period.js`, identical bodies); this is the
 * single copy.
 */
export function currentPeriodKey(date: Date = new Date()): string {
  // getUTCMonth() is 0-indexed (July = 6), hence the +1.
  // padStart keeps "2026-07" rather than "2026-7", so period keys sort and
  // compare correctly as plain strings.
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

const PERIOD_KEY_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isValidPeriodKey(periodKey: string): boolean {
  return PERIOD_KEY_RE.test(periodKey);
}

/**
 * Half-open UTC bounds for a period key: [start, end).
 *
 * These matter beyond convenience. The `Payout` table's idempotency comes from
 * its existing `@@unique([providerId, periodEnd])` constraint, so deriving a
 * stable periodEnd from the period key is what makes re-running the same month
 * safe. The standalone service tried to upsert on a `providerId_periodKey`
 * compound key that its own schema never declared, and never supplied
 * periodStart/periodEnd at all — both of which would have failed at runtime.
 */
export function periodKeyBounds(periodKey: string): { periodStart: Date; periodEnd: Date } {
  const match = PERIOD_KEY_RE.exec(periodKey);
  if (!match) {
    throw new Error(`Invalid periodKey "${periodKey}" — expected "YYYY-MM", e.g. "2026-07"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]); // 1-12

  return {
    periodStart: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    // Exclusive upper bound: the first instant of the following month.
    periodEnd: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
  };
}
