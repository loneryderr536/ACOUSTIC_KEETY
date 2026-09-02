import Stripe from 'stripe';

/**
 * Single Stripe SDK instance for the whole app.
 *
 * Ported from the standalone service's `src/config/stripe.js`, with two
 * deliberate changes:
 *
 *  1. No `apiVersion` pin. The old service pinned '2024-06-20', which the
 *     stripe@22 typings reject outright. Leaving it unset means the SDK uses
 *     the version its own types were generated against, which is the only
 *     combination that typechecks. Pin it again only by moving to a version
 *     string this SDK major actually knows about.
 *  2. Returns `null` instead of throwing when the key is missing, so the app
 *     still boots without Stripe configured (existing BigKahoona behaviour —
 *     routes answer 503 rather than crashing at import time).
 */
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe | null {
  if (stripeInstance) return stripeInstance;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.warn('[stripe] STRIPE_SECRET_KEY not configured');
    return null;
  }

  stripeInstance = new Stripe(key);
  return stripeInstance;
}

/** Currency for provider transfers. Connected accounts are created with
 *  country `au`, but the live payout engine has always sent `usd`. Kept as one
 *  env-driven constant so both engines agree — set STRIPE_PAYOUT_CURRENCY=aud
 *  once that is a settled business decision. */
export const PAYOUT_CURRENCY = (process.env.STRIPE_PAYOUT_CURRENCY || 'usd').toLowerCase();
