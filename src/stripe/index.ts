/**
 * The whole Stripe integration lives in this folder. Import from here.
 *
 *   import { getStripe, runMonthlyPayout } from '@/stripe';
 *
 * See README.md in this folder for the map and for what changed during the
 * merge of the standalone `Stripe/` service into this repo.
 */

export { getStripe, PAYOUT_CURRENCY } from './client';
export { currentPeriodKey, isValidPeriodKey, periodKeyBounds } from './period';
export {
  tierPriceIds,
  priceIdForPlan,
  planForPriceId,
  depositPriceId,
  overagePriceIds,
} from './prices';
export { isDuplicateEvent, markEventProcessed } from './events';
export { splitInvoiceRevenue, recordInvoiceRevenue, type RevenueSplit } from './revenue';
export {
  appUrl,
  createConnectedAccount,
  createOnboardingLink,
  getAccountStatus,
  accountStatusOf,
  syncAccountStatus,
  type AccountStatus,
} from './connect';
export { createSubscriptionCheckout, createPortalSession, type CheckoutOutcome } from './checkout';
export { createDepositCheckout, type DepositOutcome } from './deposits';
export { usagePeriodKey, backfillUsagePeriodKeys } from './usage';

// Rolling per-provider engine (live today).
export {
  PROVIDER_SHARE,
  MIN_PAYOUT_CENTS,
  CENTS_PER_CREDIT,
  getLastReconciledBoundary,
  aggregateProviderEarnings,
  runPayoutForProvider,
  runAllPayouts,
  type PayoutRunResult,
  type PayoutRunProviderResult,
} from './payouts';

// Monthly revenue-pool engine (ported from the standalone service).
export {
  runMonthlyPayout,
  qualityMultiplier,
  SUBSCRIPTION_PROVIDER_SHARE,
  OVERAGE_PROVIDER_SHARE,
  RESERVE_PCT,
  MIN_PAYOUT_THRESHOLD_CENTS,
  type MonthlyPayoutSummary,
} from './monthly-payout';

export * as handlers from './handlers';
