import { prisma } from '@/lib/prisma';
import { getStripe, PAYOUT_CURRENCY } from './client';
import { periodKeyBounds } from './period';

/**
 * The monthly revenue-pool payout engine.
 *
 * This is the standalone service's `payoutService.js`, algorithm intact —
 * every stage, constant and ordering decision is preserved. What changed is
 * only what had to, to run against BigKahoona's schema and Prisma 7:
 *
 *   Provider              -> User (role 'provider')
 *   Consumer              -> User (subscriber)
 *   UsageEvent            -> ApiCall (weight = creditsConsumed)
 *   PayoutLedger          -> Payout
 *   Agent.suspended       -> Agent.status === 'suspended'
 *   provider.stripeConnectedAccountId -> user.stripeAccountId
 *
 * Two latent bugs in the original are fixed here rather than carried over:
 *
 *   1. It upserted on `providerId_periodKey`, a compound unique its own schema
 *      never declared (the schema's unique was `[providerId, periodStart]`).
 *      Every write would have thrown. Here the upsert uses `Payout`'s real
 *      `@@unique([providerId, periodEnd])`, with periodEnd derived from the
 *      period key — same idempotency, actually valid.
 *   2. Its `create` payloads never supplied `periodStart`/`periodEnd`, both
 *      non-null columns. Also would have thrown. Both are supplied here.
 *
 * Still true from the original, and worth keeping in front of you:
 * RESERVE_PCT and MIN_PAYOUT_THRESHOLD_CENTS are guesses, not business
 * decisions, and this has never been run against a real Postgres + real Stripe
 * together.
 */

export const SUBSCRIPTION_PROVIDER_SHARE = 0.65;
export const OVERAGE_PROVIDER_SHARE = 0.5;

/** TODO — confirm as a real business decision. */
export const RESERVE_PCT = 0.05;

/**
 * TODO — confirm. The standalone service used $5; BigKahoona's live engine and
 * the public /terms and /reference pages both say $50. The documented figure
 * wins by default, since it is the one customers have been shown.
 */
export const MIN_PAYOUT_THRESHOLD_CENTS = 5000;

/**
 * Writing the platform's own retained revenue to the ledger needs a real User
 * row to point at, because `Payout.providerId` is a foreign key. The original
 * hardcoded the string 'platform' and left "seed a Provider row or make the FK
 * nullable" as an open question. Neither is forced here: set PLATFORM_USER_ID
 * to a real user id to get the reporting row, leave it unset to skip it.
 */
const PLATFORM_USER_ID = process.env.PLATFORM_USER_ID || null;

export type MonthlyPayoutSummary = {
  dryRun: boolean;
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
  totalRevenueCents: number;
  providerPoolCents: number;
  platformShareCents: number;
  platformRetainedFromNativeCents: number;
  reserveHeldCents: number;
  distributableCents: number;
  transfers: Array<{
    providerId: string;
    grossAmount: number;
    /** Portion of grossAmount that was owed from earlier periods. */
    carriedInCents: number;
    transferId: string;
  }>;
  carriedForward: Array<{
    providerId: string;
    /** What this period alone earned them. */
    periodShareCents: number;
    /** What was already owed before this period. */
    carriedInCents: number;
    /** Running total now owed — persisted to ProviderBalance. */
    balanceCents: number;
    weighted: number;
    sharePct: number;
  }>;
  errors: string[];
};

type AgentQuality = { status: string; rating: number | null; reviewCount: number };

/**
 * 3.0★ -> 1.0x, 5.0★ -> 1.5x. Suspended, or rated below 3.0★ -> 0x.
 *
 * One deliberate change from the standalone service: an agent with **no
 * reviews yet** returns 1.0x rather than 0x. `Agent.rating` defaults to 0, so
 * the original `rating < 3.0` test silently paid nothing for every newly listed
 * agent until it accumulated reviews — a provider would have earned zero on
 * their first period through no fault of their own, with nothing in the payout
 * summary explaining why.
 */
export function qualityMultiplier(agent: AgentQuality): number {
  if (agent.status === 'suspended') return 0;
  if (agent.reviewCount === 0) return 1.0;

  const rating = agent.rating ?? 0;
  if (rating < 3.0) return 0;
  const clamped = Math.min(rating, 5.0);
  return 1.0 + ((clamped - 3.0) / 2.0) * 0.5;
}

async function upsertPayoutRow(args: {
  dryRun: boolean;
  providerId: string;
  periodKey: string;
  periodStart: Date;
  periodEnd: Date;
  weightedCalls: number;
  sharePct: number;
  grossAmount: number;
  callCount: number;
  status: string;
  transferId?: string | null;
  failureReason?: string | null;
}) {
  const {
    providerId, periodKey, periodStart, periodEnd,
    weightedCalls, sharePct, grossAmount, callCount, status,
    transferId = null, failureReason = null,
  } = args;

  // A dry run computes and reports but writes nothing and moves nothing.
  if (args.dryRun) return null;

  const shared = {
    periodKey,
    weightedCalls,
    sharePct,
    grossCents: grossAmount,
    providerShareCents: grossAmount,
    callCount,
    status,
    stripeTransferId: transferId,
    failureReason,
    ...(status === 'paid' ? { paidAt: new Date() } : {}),
  };

  return prisma.payout.upsert({
    where: { providerId_periodEnd: { providerId, periodEnd } },
    update: shared,
    create: { providerId, periodStart, periodEnd, ...shared },
  });
}


/* ------------------------------------------------------------------ */
/*  Shared period computation                                          */
/* ------------------------------------------------------------------ */

export type PeriodSplit = {
  ok: boolean;
  /** Non-fatal warnings worth surfacing to whoever ran this. */
  notes: string[];
  /** Set when ok is false — the reason nothing can be distributed. */
  error?: string;
  totalRevenueCents: number;
  currency: string;
  nativeSharePct: number;
  platformRetainedFromNativeCents: number;
  providerPoolCents: number;
  platformShareCents: number;
  reserveHeldCents: number;
  distributableCents: number;
  weightedByProvider: Record<string, number>;
  callsByProvider: Record<string, number>;
  thirdPartyWeightedTotal: number;
  nativeWeightedTotal: number;
  nativeCallCount: number;
};

const EMPTY_SPLIT: Omit<PeriodSplit, 'ok' | 'error' | 'notes'> = {
  totalRevenueCents: 0,
  currency: PAYOUT_CURRENCY,
  nativeSharePct: 0,
  platformRetainedFromNativeCents: 0,
  providerPoolCents: 0,
  platformShareCents: 0,
  reserveHeldCents: 0,
  distributableCents: 0,
  weightedByProvider: {},
  callsByProvider: {},
  thirdPartyWeightedTotal: 0,
  nativeWeightedTotal: 0,
  nativeCallCount: 0,
};

/**
 * Everything the payout maths needs for one period, with no side effects and
 * no Stripe calls.
 *
 * Extracted so the payout run and the provider dashboard compute a provider's
 * earnings from *the same code*. They used to disagree: the dashboard showed
 * the rolling engine's number while the pool engine paid a different one, which
 * on real data was a 26x gap. A provider comparing their dashboard to their
 * bank statement would have found that before we did.
 */
export async function computePeriodSplit(periodKey: string): Promise<PeriodSplit> {
  const notes: string[] = [];

  // Revenue pooled for this period.
  const revenue = await prisma.revenuePeriod.findUnique({ where: { periodKey } });
  if (!revenue) {
    return { ok: false, notes, error: `No RevenuePeriod row for "${periodKey}" — nothing to distribute.`, ...EMPTY_SPLIT };
  }
  const totalRevenueCents = revenue.subscriptionCents + revenue.overageCents;

  // Invoices billed in another currency were recorded but excluded from the
  // pool (see the currency guard in revenue.ts). A period quietly missing
  // revenue would otherwise underpay every provider in it.
  const unpooled = await prisma.revenueInvoice.findMany({
    where: { periodKey, pooled: false },
    select: { id: true, currency: true },
  });
  if (unpooled.length > 0) {
    const currencies = [...new Set(unpooled.map((i) => i.currency.toUpperCase()))].join(', ');
    notes.push(
      `${unpooled.length} invoice(s) in this period were billed in ${currencies} and are NOT in the pool ` +
        `(settlement is ${PAYOUT_CURRENCY.toUpperCase()}). Providers are underpaid until this is reconciled.`,
    );
  }

  // Usage for the period, with enough agent detail to weight it.
  const usageEvents = await prisma.apiCall.findMany({
    where: { periodKey, status: 'success' },
    include: { agent: { select: { id: true, providerId: true, native: true, status: true, rating: true, reviewCount: true } } },
  });
  if (usageEvents.length === 0) {
    return { ok: false, notes, error: `No usage events for "${periodKey}" — nothing to distribute.`, ...EMPTY_SPLIT };
  }

  let nativeWeightedTotal = 0;
  let allWeightedTotal = 0;
  let nativeCallCount = 0;

  for (const event of usageEvents) {
    const weighted = event.creditsConsumed * qualityMultiplier(event.agent);
    allWeightedTotal += weighted;
    if (event.agent.native) {
      nativeWeightedTotal += weighted;
      nativeCallCount++;
    }
  }

  if (allWeightedTotal === 0) {
    return {
      ok: false, notes,
      error: 'All usage this period was suspended/below-rating agents — nothing to distribute.',
      ...EMPTY_SPLIT,
    };
  }

  // Native's share stays with the platform, 100%, BEFORE the pool is sized.
  // The order matters — see payout-split-spec.md.
  const nativeSharePct = nativeWeightedTotal / allWeightedTotal;
  const platformRetainedFromNativeCents = Math.round(totalRevenueCents * nativeSharePct);

  const thirdPartySubscriptionCents = Math.round(revenue.subscriptionCents * (1 - nativeSharePct));
  const thirdPartyOverageCents = Math.round(revenue.overageCents * (1 - nativeSharePct));

  const providerPoolCents = Math.round(
    thirdPartySubscriptionCents * SUBSCRIPTION_PROVIDER_SHARE +
      thirdPartyOverageCents * OVERAGE_PROVIDER_SHARE,
  );
  const platformShareCents = totalRevenueCents - providerPoolCents - platformRetainedFromNativeCents;

  const reserveHeldCents = Math.round(providerPoolCents * RESERVE_PCT);
  const distributableCents = providerPoolCents - reserveHeldCents;

  // Roll up to provider level, excluding native agents entirely.
  const weightedByProvider: Record<string, number> = {};
  const callsByProvider: Record<string, number> = {};

  for (const event of usageEvents) {
    if (event.agent.native) continue;
    const pid = event.agent.providerId;
    weightedByProvider[pid] = (weightedByProvider[pid] || 0) + event.creditsConsumed * qualityMultiplier(event.agent);
    callsByProvider[pid] = (callsByProvider[pid] || 0) + 1;
  }

  const thirdPartyWeightedTotal = Object.values(weightedByProvider).reduce((sum, w) => sum + w, 0);
  if (thirdPartyWeightedTotal === 0) {
    notes.push('No third-party usage this period — the whole pool stays with the platform.');
  }

  return {
    ok: true,
    notes,
    totalRevenueCents,
    currency: revenue.currency,
    nativeSharePct,
    platformRetainedFromNativeCents,
    providerPoolCents,
    platformShareCents,
    reserveHeldCents,
    distributableCents,
    weightedByProvider,
    callsByProvider,
    thirdPartyWeightedTotal,
    nativeWeightedTotal,
    nativeCallCount,
  };
}

/**
 * What one provider would be allocated for a period, from the same maths the
 * payout run uses. Read-only, no Stripe call — safe to call from a dashboard.
 */
export async function estimateProviderShare(providerId: string, periodKey: string) {
  const split = await computePeriodSplit(periodKey);
  if (!split.ok) {
    return {
      periodKey, grossCents: 0, shareCents: 0, carriedInCents: 0, payableCents: 0,
      weighted: 0, sharePct: 0, callCount: 0,
      currency: PAYOUT_CURRENCY, belowMinimum: false, reason: split.error,
    };
  }

  const weighted = split.weightedByProvider[providerId] ?? 0;
  const sharePct = split.thirdPartyWeightedTotal > 0 ? weighted / split.thirdPartyWeightedTotal : 0;

  // Anything still owed from earlier periods counts toward the next payout, so
  // the dashboard has to show it or a provider sees "below minimum" three
  // months running with no sense that the total is climbing.
  const balanceRow = await prisma.providerBalance.findUnique({ where: { providerId } });
  const carriedInCents =
    balanceRow && balanceRow.lastPeriodKey === periodKey ? 0 : balanceRow?.pendingCents ?? 0;
  // Gross is this provider's slice of the pool before the reserve is withheld;
  // shareCents is what would actually transfer. Showing both makes the reserve
  // visible to the provider rather than an unexplained shortfall.
  const grossCents = Math.round(sharePct * split.providerPoolCents);
  const shareCents = Math.round(sharePct * split.distributableCents);

  const payableCents = shareCents + carriedInCents;

  return {
    periodKey,
    grossCents,
    shareCents,
    carriedInCents,
    payableCents,
    weighted,
    sharePct,
    callCount: split.callsByProvider[providerId] ?? 0,
    currency: split.currency,
    belowMinimum: payableCents > 0 && payableCents < MIN_PAYOUT_THRESHOLD_CENTS,
    reason: undefined as string | undefined,
  };
}

/**
 * `dryRun` defaults to TRUE. This engine and the rolling engine in payouts.ts
 * both write to the same `Payout` table, so running both against one period
 * would pay providers twice. Moving real money has to be asked for explicitly.
 */
export async function runMonthlyPayout(
  periodKey: string,
  opts: { dryRun?: boolean; allowOpenPeriod?: boolean } = {},
): Promise<MonthlyPayoutSummary> {
  const dryRun = opts.dryRun ?? true;
  const { periodStart, periodEnd } = periodKeyBounds(periodKey);

  const summary: MonthlyPayoutSummary = {
    dryRun,
    periodKey,
    periodStart,
    periodEnd,
    totalRevenueCents: 0,
    providerPoolCents: 0,
    platformShareCents: 0,
    platformRetainedFromNativeCents: 0,
    reserveHeldCents: 0,
    distributableCents: 0,
    transfers: [],
    carriedForward: [],
    errors: [],
  };

  // Refuse to pay out a month that has not finished.
  //
  // This engine selects usage by the `periodKey` LABEL rather than by time, so
  // mid-month it will happily distribute a full month's revenue against partial
  // usage — and, if anything ever writes a future-dated row, against usage that
  // has not happened. The rolling engine in payouts.ts cannot make this mistake
  // because it aggregates on `createdAt < now`. Previewing an open period is
  // useful; paying one out is not.
  const now = new Date();
  if (periodEnd > now) {
    summary.errors.push(
      `Period "${periodKey}" has not closed yet (ends ${periodEnd.toISOString().slice(0, 10)}). ` +
        'Revenue and usage are both still accumulating, so these figures are provisional.',
    );
    if (!dryRun && !opts.allowOpenPeriod) {
      summary.errors.push('Refusing to move money for an open period. Pass allowOpenPeriod: true to override.');
      return summary;
    }
  }

  const stripe = getStripe();
  if (!stripe) {
    summary.errors.push('Stripe is not configured — STRIPE_SECRET_KEY is unset.');
    return summary;
  }

  // ── Stages 1-5: pooled revenue, weighted usage, splits ──────────────────
  // All of it lives in computePeriodSplit so the provider dashboard computes a
  // provider's earnings from exactly this code rather than its own copy.
  const split = await computePeriodSplit(periodKey);
  summary.errors.push(...split.notes);
  if (!split.ok) {
    summary.errors.push(split.error ?? 'Period could not be computed.');
    return summary;
  }

  const {
    totalRevenueCents, nativeSharePct, platformRetainedFromNativeCents,
    providerPoolCents, platformShareCents, reserveHeldCents, distributableCents,
    weightedByProvider, callsByProvider, thirdPartyWeightedTotal,
    nativeWeightedTotal, nativeCallCount,
  } = split;

  summary.totalRevenueCents = totalRevenueCents;
  summary.platformRetainedFromNativeCents = platformRetainedFromNativeCents;
  summary.providerPoolCents = providerPoolCents;
  summary.platformShareCents = platformShareCents;
  summary.reserveHeldCents = reserveHeldCents;
  summary.distributableCents = distributableCents;

  // Balance check stays here — it needs Stripe, and computePeriodSplit is
  // deliberately side-effect free so a dashboard can call it.
  const balance = await stripe.balance.retrieve();
  const availableCents = balance.available.reduce((sum, b) => sum + b.amount, 0);
  if (availableCents < providerPoolCents) {
    summary.errors.push(
      `Available Stripe balance (${availableCents}c) is less than the computed pool (${providerPoolCents}c) — aborting.`,
    );
    return summary;
  }

  // ── Stage 6: pay each third-party provider ──────────────────────────────
  for (const [providerId, weighted] of Object.entries(weightedByProvider)) {
    const sharePct = weighted / thirdPartyWeightedTotal;
    const periodShareCents = Math.round(sharePct * distributableCents);
    const callCount = callsByProvider[providerId] ?? 0;

    // What this provider was already owed from periods that fell short of the
    // minimum. Re-running the same period must not stack its share twice, so a
    // balance already tagged with this periodKey is treated as containing it.
    const existing = await prisma.providerBalance.findUnique({ where: { providerId } });
    const carriedInCents =
      existing && existing.lastPeriodKey === periodKey
        ? Math.max(0, existing.pendingCents - periodShareCents)
        : existing?.pendingCents ?? 0;

    const grossAmount = periodShareCents + carriedInCents;

    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: { id: true, stripeAccountId: true, chargesEnabled: true, payoutsEnabled: true },
    });

    // Pulled out as its own const so the `!destination` check below narrows it
    // to `string` for stripe.transfers.create. An earlier version tested a
    // `Boolean(...)` flag instead, which reads the same but narrows nothing —
    // tsc was right to warn that a null destination could reach Stripe.
    const destination = provider?.stripeAccountId ?? null;
    const onboarded = Boolean(
      destination && provider?.chargesEnabled && provider?.payoutsEnabled,
    );

    // Below the minimum, or not payout-capable: the money stays owed. Persist
    // it, so next period adds to it rather than starting from zero.
    if (grossAmount < MIN_PAYOUT_THRESHOLD_CENTS || !destination || !onboarded) {
      if (!dryRun) {
        await prisma.providerBalance.upsert({
          where: { providerId },
          update: { pendingCents: grossAmount, currency: PAYOUT_CURRENCY, lastPeriodKey: periodKey },
          create: { providerId, pendingCents: grossAmount, currency: PAYOUT_CURRENCY, lastPeriodKey: periodKey },
        });
      }

      await upsertPayoutRow({
        dryRun, providerId, periodKey, periodStart, periodEnd,
        weightedCalls: weighted, sharePct, grossAmount, callCount,
        status: onboarded ? 'carried_forward' : 'held_incomplete_onboarding',
      });

      summary.carriedForward.push({
        providerId, periodShareCents, carriedInCents, balanceCents: grossAmount, weighted, sharePct,
      });

      if (!onboarded) {
        summary.errors.push(
          `Provider ${providerId} not fully onboarded — ${grossAmount}c held and carried forward, not lost.`,
        );
      }
      continue;
    }

    // Write PENDING first. Real money hasn't moved yet, but the INTENT to move
    // it is on disk before we ask Stripe to do anything irreversible. If the
    // process dies between Stripe confirming and the next write, this row is
    // what lets you go and check whether it actually went through, instead of
    // finding no record of the attempt at all.
    await upsertPayoutRow({
      dryRun, providerId, periodKey, periodStart, periodEnd,
      weightedCalls: weighted, sharePct, grossAmount, callCount,
      status: 'pending',
    });

    if (dryRun) {
      summary.transfers.push({ providerId, grossAmount, carriedInCents, transferId: '(dry-run — nothing sent)' });
      continue;
    }

    try {
      const transfer = await stripe.transfers.create(
        {
          amount: grossAmount,
          currency: PAYOUT_CURRENCY,
          destination,
          description: `Acoustic Kitty payout for ${periodKey}`,
          metadata: {
            providerId, periodKey,
            weightedCalls: String(weighted),
            carriedInCents: String(carriedInCents),
          },
        },
        { idempotencyKey: `payout_${providerId}_${periodKey}` },
      );

      await upsertPayoutRow({
        dryRun, providerId, periodKey, periodStart, periodEnd,
        weightedCalls: weighted, sharePct, grossAmount, callCount,
        status: 'paid', transferId: transfer.id,
      });

      // Settled — and only now. Zeroing before the transfer confirmed would
      // erase the debt without paying it.
      await prisma.providerBalance.upsert({
        where: { providerId },
        update: { pendingCents: 0, currency: PAYOUT_CURRENCY, lastPeriodKey: periodKey },
        create: { providerId, pendingCents: 0, currency: PAYOUT_CURRENCY, lastPeriodKey: periodKey },
      });

      summary.transfers.push({ providerId, grossAmount, carriedInCents, transferId: transfer.id });
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'Unknown Stripe error';
      await upsertPayoutRow({
        dryRun, providerId, periodKey, periodStart, periodEnd,
        weightedCalls: weighted, sharePct, grossAmount, callCount,
        status: 'failed', failureReason: reason,
      });

      // The transfer failed, so the money is still owed. Carrying the full
      // amount forward means a bad month costs the provider a delay, not their
      // earnings — and the next run simply retries the whole balance.
      await prisma.providerBalance.upsert({
        where: { providerId },
        update: { pendingCents: grossAmount, currency: PAYOUT_CURRENCY, lastPeriodKey: periodKey },
        create: { providerId, pendingCents: grossAmount, currency: PAYOUT_CURRENCY, lastPeriodKey: periodKey },
      });

      summary.errors.push(`Transfer to ${providerId} failed: ${reason} — ${grossAmount}c carried forward.`);
    }
  }

  // ── Stage 7: record native's retained revenue, for reporting parity ─────
  if (summary.platformRetainedFromNativeCents > 0) {
    if (!PLATFORM_USER_ID) {
      summary.errors.push(
        `PLATFORM_USER_ID is unset — skipped the retained_native reporting row for ${summary.platformRetainedFromNativeCents}c.`,
      );
    } else {
      await upsertPayoutRow({
        dryRun,
        providerId: PLATFORM_USER_ID,
        periodKey, periodStart, periodEnd,
        weightedCalls: nativeWeightedTotal,
        sharePct: nativeSharePct,
        grossAmount: summary.platformRetainedFromNativeCents,
        callCount: nativeCallCount,
        status: 'retained_native',
      });
    }
  }

  return summary;
}
