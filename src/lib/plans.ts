/**
 * `callsLimit` / `callsBalance` / `callsUsed` are denominated in CREDITS,
 * not raw calls. 1 credit = A$0.01. A Haiku-tier agent call burns 1 credit,
 * Standard = 2, Premium = 10 (see MODEL_TIER_WEIGHTS below).
 *
 * This comment said "Standard = 3" while MODEL_TIER_WEIGHTS said 2, which is
 * the number that actually runs. docs/CONTEXT.md was corrected 3 -> 2 upstream,
 * so 2 is intended and this comment was the stale half.
 *
 * Plan dollar price = credit count × $0.01. Subscribers always get
 * credit dollar value equal to their subscription dollars.
 *
 * `allowedModelTiers = null` means every tier is available.
 */
export const PLANS = {
  recruit: {
    label: 'RECRUIT',
    price: 0,
    callsLimit: 100,
    dailyAllowance: 4,
    dailyCeiling: 8,
    burstPerMinute: 5,
    burstPerHour: 60,
    concurrentPerAgent: 1,
    overageRate: 0,
    messagingEnabled: false,
    allowedModelTiers: ['haiku'] as string[] | null,
  },
  field_agent: {
    label: 'FIELD AGENT',
    price: 19,
    callsLimit: 1_900,
    dailyAllowance: 64,
    dailyCeiling: 128,
    burstPerMinute: 30,
    burstPerHour: 500,
    concurrentPerAgent: 3,
    overageRate: 0,
    messagingEnabled: true,
    allowedModelTiers: null as string[] | null,
  },
  double_0: {
    label: 'DOUBLE-0',
    price: 79,
    callsLimit: 7_900,
    dailyAllowance: 264,
    dailyCeiling: 528,
    burstPerMinute: 100,
    burstPerHour: 2_000,
    concurrentPerAgent: 10,
    overageRate: 0,
    messagingEnabled: true,
    allowedModelTiers: null as string[] | null,
  },
  shadow: {
    label: 'SHADOW',
    price: 249,
    callsLimit: 24_900,
    dailyAllowance: 830,
    dailyCeiling: 1_660,
    burstPerMinute: 500,
    burstPerHour: 10_000,
    concurrentPerAgent: 25,
    overageRate: 0,
    messagingEnabled: true,
    allowedModelTiers: null as string[] | null,
  },
} as const;

export type PlanId = keyof typeof PLANS;
export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

export const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  explorer: 'recruit',
  builder: 'field_agent',
  scale: 'double_0',
};

export function resolvePlan(plan: string): PlanId {
  return (LEGACY_PLAN_MAP[plan] ?? plan) as PlanId;
}

export function getPlanConfig(plan: string) {
  const resolved = resolvePlan(plan);
  return PLANS[resolved] ?? PLANS.recruit;
}

// ---------------------------------------------------------------------------
// Model-tier call weights
// ---------------------------------------------------------------------------

export const MODEL_TIER_WEIGHTS: Record<string, number> = {
  haiku: 1,
  standard: 2,
  premium: 10,
  unknown: 1,
};

export function getCallWeight(modelTier: string): number {
  return MODEL_TIER_WEIGHTS[modelTier] ?? 1;
}
