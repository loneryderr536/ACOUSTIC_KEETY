/**
 * Compatibility shim. The payout engines now live in `src/stripe/`:
 *   - `src/stripe/payouts.ts`        rolling per-provider (this file's original contents)
 *   - `src/stripe/monthly-payout.ts` monthly revenue-pool split
 *
 * This file stays so existing `@/lib/payouts` imports keep working
 * (`api/admin/payouts`, `api/provider/payouts`, `api/provider/stats`).
 * Prefer importing from `@/stripe`.
 */
export * from '@/stripe/payouts';
