import { resolvePlan, type PlanId } from '@/lib/plans';

/**
 * One place that knows which Stripe Price ID maps to which plan.
 *
 * CONFLICT FIX: the two codebases named the same env vars differently —
 * BigKahoona used STRIPE_FIELD_AGENT_PRICE_ID, the standalone service used
 * PRICE_FIELD_AGENT. Rather than force a rename across Railway's env config,
 * both spellings are accepted, BigKahoona's taking precedence. Once Railway is
 * cleaned up, the `PRICE_*` fallbacks can be deleted.
 */
function priceEnv(...names: string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

export function tierPriceIds(): Partial<Record<PlanId, string>> {
  return {
    recruit: priceEnv('STRIPE_RECRUIT_PRICE_ID', 'PRICE_RECRUIT'),
    field_agent: priceEnv('STRIPE_FIELD_AGENT_PRICE_ID', 'PRICE_FIELD_AGENT', 'STRIPE_BUILDER_PRICE_ID'),
    double_0: priceEnv('STRIPE_DOUBLE_0_PRICE_ID', 'PRICE_DOUBLE_0', 'STRIPE_SCALE_PRICE_ID'),
    shadow: priceEnv('STRIPE_SHADOW_PRICE_ID', 'PRICE_SHADOW'),
  };
}

export function priceIdForPlan(plan: string): string | undefined {
  return tierPriceIds()[resolvePlan(plan)];
}

/**
 * Reverse lookup, used by subscription events where Stripe hands us a Price ID
 * rather than our internal plan name.
 */
export function planForPriceId(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  for (const [plan, id] of Object.entries(tierPriceIds())) {
    if (id && id === priceId) return plan as PlanId;
  }
  return null;
}

/** The one-off provider listing deposit ($49). */
export function depositPriceId(): string | undefined {
  return priceEnv('STRIPE_LISTING_DEPOSIT_PRICE_ID', 'PRICE_LISTING_DEPOSIT');
}

/**
 * Metered overage prices. Used only to tell overage revenue apart from
 * subscription revenue on a paid invoice — see revenue.ts.
 *
 * If these are unset, every invoice line is counted as subscription revenue.
 * That was flagged as an assumption in the standalone service and it still is.
 */
export function overagePriceIds(): string[] {
  return [
    priceEnv('STRIPE_OVERAGE_FIELD_AGENT_PRICE_ID', 'PRICE_OVERAGE_FIELD_AGENT'),
    priceEnv('STRIPE_OVERAGE_DOUBLE_0_PRICE_ID', 'PRICE_OVERAGE_DOUBLE_0'),
    priceEnv('STRIPE_OVERAGE_SHADOW_PRICE_ID', 'PRICE_OVERAGE_SHADOW'),
  ].filter((id): id is string => Boolean(id));
}
