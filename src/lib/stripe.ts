/**
 * Compatibility shim. The Stripe client now lives in `src/stripe/client.ts`
 * along with the rest of the integration; this file stays so existing
 * `@/lib/stripe` imports keep working. Prefer importing from `@/stripe`.
 */
export { getStripe, PAYOUT_CURRENCY } from '@/stripe/client';
