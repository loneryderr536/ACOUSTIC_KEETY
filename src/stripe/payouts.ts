/**
 * Rolling per-provider payout engine — MOVED here unchanged from
 * `src/lib/payouts.ts`. This is the engine that is live on Railway today.
 *
 * It answers a different question from `monthly-payout.ts`: this one pays each
 * provider whatever they have accrued since their last reconciled boundary,
 * straight from ApiCall credits. The monthly one splits a fixed revenue pool
 * for a named calendar month. Both now live in this folder; the admin routes
 * pick which to run. Nothing that imported `@/lib/payouts` had to change —
 * that path is now a re-export shim pointing here.
 *
 * The only edit made during the move: currency is `PAYOUT_CURRENCY` rather
 * than a hardcoded 'usd', so both engines send the same currency.
 */
import { prisma } from '@/lib/prisma';
import { getStripe, PAYOUT_CURRENCY } from './client';

/**
 * Fraction of successful-call costCents that a provider keeps.
 * Remainder is the platform fee. Kept server-side only — never exposed
 * as a percentage on public surfaces (see 2026-04-23 honesty pass).
 */
export const PROVIDER_SHARE = 0.65;

/**
 * Providers must accrue at least this much in provider-share cents
 * before a payout is initiated. Below this, earnings roll forward.
 * Matches the $50 figure we document in /terms and /reference.
 */
export const MIN_PAYOUT_CENTS = 5000;

/**
 * Dollar value of one Acoustic Kitty credit. Subscriptions are priced
 * as "your subscription dollars = credit dollars", so 1 credit = $0.01
 * means $19/mo = 1,900 credits of consumable value.
 *
 * The runner multiplies each call's creditsConsumed by this to arrive
 * at the cents figure used in aggregation, then applies PROVIDER_SHARE.
 */
export const CENTS_PER_CREDIT = 1;

/**
 * Below this rating an agent earns nothing for the period.
 *
 * NOTE this is a GATE, not a multiplier. The monthly pool engine scales
 * earnings from 1.0x at 3.0 stars to 1.5x at 5.0 stars, which works there
 * because it is dividing a FIXED pool — relative weights cannot inflate the
 * total. This engine has no pool: it pays 65% of credits actually consumed, so
 * a 1.5x bonus would pay out 97.5% of the credit value and leave the platform
 * with nothing. Quality can only disqualify here; it cannot pay a premium.
 */
export const MIN_RATING_FOR_PAYOUT = 3.0;

/**
 * Whether an agent's usage earns its provider anything this period.
 *
 * An unrated agent is NOT a bad agent. `Agent.rating` defaults to 0, so a
 * straight `rating >= 3.0` test would silently pay nothing for every newly
 * listed agent until it collected reviews — punishing providers for being new.
 * Agents with no reviews yet are treated as neutral and earn the full share.
 */
export function earnsPayout(agent: { status: string; rating: number | null; reviewCount: number }): boolean {
  if (agent.status === 'suspended') return false;
  if (agent.reviewCount === 0) return true;
  return (agent.rating ?? 0) >= MIN_RATING_FOR_PAYOUT;
}

export type PayoutRunResult = {
  periodEnd: Date;
  providers: number;
  paid: number;
  skipped: number;
  failed: number;
  totalGrossCents: number;
  totalProviderShareCents: number;
  results: PayoutRunProviderResult[];
};

export type PayoutRunProviderResult = {
  providerId: string;
  providerEmail: string;
  status: 'paid' | 'skipped' | 'failed';
  grossCents: number;
  providerShareCents: number;
  callCount: number;
  payoutId?: string;
  stripeTransferId?: string;
  skipReason?: string;
  failureReason?: string;
};

/**
 * Returns the boundary past which earnings are considered already paid.
 * Only `paid` payouts advance this boundary — skipped and failed payouts
 * leave the aggregation window open so unpaid earnings roll forward into
 * the next cycle instead of being silently forgotten.
 */
export async function getLastReconciledBoundary(providerId: string): Promise<Date | null> {
  const latest = await prisma.payout.findFirst({
    where: { providerId, status: 'paid' },
    orderBy: { periodEnd: 'desc' },
    select: { periodEnd: true },
  });
  return latest?.periodEnd ?? null;
}

/**
 * Aggregate unpaid successful earnings for a single provider between the
 * last reconciled boundary (exclusive) and `periodEnd` (exclusive).
 */
export async function aggregateProviderEarnings(
  providerId: string,
  periodEnd: Date,
): Promise<{ grossCents: number; callCount: number; periodStart: Date }> {
  const last = await getLastReconciledBoundary(providerId);
  const periodStart = last ?? new Date(0);

  // Find this provider's agents, then drop the ones that don't earn.
  //
  // Two exclusions, both added when the standalone service was merged in:
  //  - `native` agents belong to the platform. Their revenue is retained in
  //    full and must never be transferred out — without this filter, a payout
  //    run would try to pay the platform's own provider row.
  //  - suspended or poorly-rated agents earn nothing (see earnsPayout).
  const allAgents = await prisma.agent.findMany({
    where: { providerId },
    select: { id: true, native: true, status: true, rating: true, reviewCount: true },
  });
  const agents = allAgents.filter((a) => !a.native && earnsPayout(a));

  if (agents.length === 0) {
    return { grossCents: 0, callCount: 0, periodStart };
  }

  const agg = await prisma.apiCall.aggregate({
    where: {
      agentId: { in: agents.map((a) => a.id) },
      status: 'success',
      createdAt: {
        gt: periodStart,
        lt: periodEnd,
      },
    },
    _sum: { creditsConsumed: true },
    _count: { _all: true },
  });

  // Gross cents = credits consumed × value of each credit. This is the
  // amount of subscription revenue attributable to the provider's
  // successful calls. PROVIDER_SHARE of this is what actually moves.
  const creditsConsumed = agg._sum.creditsConsumed ?? 0;
  const grossCents = creditsConsumed * CENTS_PER_CREDIT;

  return {
    grossCents,
    callCount: agg._count._all,
    periodStart,
  };
}

/**
 * Run a payout for a single provider. Creates a Payout row in all cases
 * (pending → paid, skipped, or failed) so we have an audit trail.
 */
export async function runPayoutForProvider(
  providerId: string,
  periodEnd: Date,
): Promise<PayoutRunProviderResult> {
  const provider = await prisma.user.findUnique({
    where: { id: providerId },
    select: { id: true, email: true, stripeAccountId: true, role: true },
  });
  if (!provider) {
    return {
      providerId,
      providerEmail: 'unknown',
      status: 'failed',
      grossCents: 0,
      providerShareCents: 0,
      callCount: 0,
      failureReason: 'Provider not found',
    };
  }

  const { grossCents, callCount, periodStart } = await aggregateProviderEarnings(
    providerId,
    periodEnd,
  );
  const providerShareCents = Math.floor(grossCents * PROVIDER_SHARE);

  // Short-circuit: no earnings to pay — no-op, don't pollute audit log.
  // Boundary stays put; provider has nothing to pay out.
  if (grossCents === 0 || callCount === 0) {
    return {
      providerId,
      providerEmail: provider.email,
      status: 'skipped',
      grossCents,
      providerShareCents,
      callCount,
      skipReason: 'no_earnings',
    };
  }

  // Short-circuit: below minimum threshold. Intentionally do NOT write a
  // Payout row — earnings roll forward into the next cycle. Writing a
  // row here would require correct handling of future aggregations
  // crossing over this window, which complicates the boundary model for
  // no provider benefit.
  if (providerShareCents < MIN_PAYOUT_CENTS) {
    return {
      providerId,
      providerEmail: provider.email,
      status: 'skipped',
      grossCents,
      providerShareCents,
      callCount,
      skipReason: 'below_minimum',
    };
  }

  // Short-circuit: no Stripe Connect account
  if (!provider.stripeAccountId) {
    const payout = await createPayoutRow(
      providerId,
      periodStart,
      periodEnd,
      grossCents,
      providerShareCents,
      callCount,
      'skipped',
      'no_stripe_account',
    );
    return {
      providerId,
      providerEmail: provider.email,
      status: 'skipped',
      grossCents,
      providerShareCents,
      callCount,
      payoutId: payout?.id,
      skipReason: 'no_stripe_account',
    };
  }

  const stripe = getStripe();
  if (!stripe) {
    return {
      providerId,
      providerEmail: provider.email,
      status: 'failed',
      grossCents,
      providerShareCents,
      callCount,
      failureReason: 'Stripe not configured',
    };
  }

  // Verify the Connected Account is actually payout-capable right now.
  try {
    const account = await stripe.accounts.retrieve(provider.stripeAccountId);
    if (!account.payouts_enabled) {
      const payout = await createPayoutRow(
        providerId,
        periodStart,
        periodEnd,
        grossCents,
        providerShareCents,
        callCount,
        'skipped',
        'payouts_not_enabled',
      );
      return {
        providerId,
        providerEmail: provider.email,
        status: 'skipped',
        grossCents,
        providerShareCents,
        callCount,
        payoutId: payout?.id,
        skipReason: 'payouts_not_enabled',
      };
    }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown Stripe error';
    // Write an audit row so operators can see which providers fail at the
    // account-retrieve step (missing/revoked Stripe account, wrong env, etc).
    const payout = await createPayoutRow(
      providerId,
      periodStart,
      periodEnd,
      grossCents,
      providerShareCents,
      callCount,
      'failed',
      `account_retrieve: ${reason}`,
    );
    return {
      providerId,
      providerEmail: provider.email,
      status: 'failed',
      grossCents,
      providerShareCents,
      callCount,
      payoutId: payout?.id,
      failureReason: `account_retrieve: ${reason}`,
    };
  }

  // Create the Payout row first in 'pending' so we have an audit trail
  // even if the Transfer call throws mid-flight. The unique (providerId,
  // periodEnd) constraint makes this idempotent across re-runs.
  let payoutId: string;
  try {
    const payoutRow = await prisma.payout.create({
      data: {
        providerId,
        periodStart,
        periodEnd,
        grossCents,
        providerShareCents,
        callCount,
        status: 'pending',
      },
    });
    payoutId = payoutRow.id;
  } catch (err) {
    // Most likely a duplicate (same periodEnd already paid). Surface as
    // a skip so the runner's summary stays sensible.
    return {
      providerId,
      providerEmail: provider.email,
      status: 'skipped',
      grossCents,
      providerShareCents,
      callCount,
      skipReason: 'already_processed',
    };
  }

  // Execute the transfer.
  try {
    const transfer = await stripe.transfers.create(
      {
        amount: providerShareCents,
        currency: PAYOUT_CURRENCY,
        destination: provider.stripeAccountId,
        description: `Acoustic Kitty payout for period ending ${periodEnd.toISOString().slice(0, 10)}`,
        metadata: {
          providerId,
          payoutId,
          callCount: String(callCount),
          periodEnd: periodEnd.toISOString(),
        },
      },
      {
        // Idempotency so retries of this exact transfer never double-send.
        idempotencyKey: `payout_${payoutId}`,
      },
    );

    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'paid',
        stripeTransferId: transfer.id,
        paidAt: new Date(),
      },
    });

    return {
      providerId,
      providerEmail: provider.email,
      status: 'paid',
      grossCents,
      providerShareCents,
      callCount,
      payoutId,
      stripeTransferId: transfer.id,
    };
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Unknown Stripe error';
    await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: 'failed',
        failureReason: reason,
      },
    });
    return {
      providerId,
      providerEmail: provider.email,
      status: 'failed',
      grossCents,
      providerShareCents,
      callCount,
      payoutId,
      failureReason: reason,
    };
  }
}

async function createPayoutRow(
  providerId: string,
  periodStart: Date,
  periodEnd: Date,
  grossCents: number,
  providerShareCents: number,
  callCount: number,
  status: 'skipped' | 'failed',
  reason: string,
): Promise<{ id: string } | null> {
  try {
    return await prisma.payout.create({
      data: {
        providerId,
        periodStart,
        periodEnd,
        grossCents,
        providerShareCents,
        callCount,
        status,
        skipReason: status === 'skipped' ? reason : undefined,
        failureReason: status === 'failed' ? reason : undefined,
      },
      select: { id: true },
    });
  } catch {
    // duplicate (providerId, periodEnd) — silently swallow, caller already
    // has enough context from the returned result.
    return null;
  }
}

/**
 * Run payouts for every provider with at least one successful call in the
 * aggregation window. Returns a summary result for telemetry / admin UI.
 */
export async function runAllPayouts(periodEnd: Date): Promise<PayoutRunResult> {
  // Find every provider that has at least one successful call logged.
  // We do this via the Agent → ApiCall join rather than scanning all users.
  const providerAgents = await prisma.agent.findMany({
    where: {
      apiCalls: { some: { status: 'success' } },
    },
    select: { providerId: true },
    distinct: ['providerId'],
  });

  const results: PayoutRunProviderResult[] = [];
  let paid = 0;
  let skipped = 0;
  let failed = 0;
  let totalGrossCents = 0;
  let totalProviderShareCents = 0;

  for (const { providerId } of providerAgents) {
    const result = await runPayoutForProvider(providerId, periodEnd);
    results.push(result);
    totalGrossCents += result.grossCents;
    totalProviderShareCents += result.providerShareCents;
    if (result.status === 'paid') paid++;
    else if (result.status === 'skipped') skipped++;
    else failed++;
  }

  return {
    periodEnd,
    providers: providerAgents.length,
    paid,
    skipped,
    failed,
    totalGrossCents,
    totalProviderShareCents,
    results,
  };
}

/* ------------------------------------------------------------------ */
/*  Dry run                                                            */
/* ------------------------------------------------------------------ */

export type PayoutPreviewRow = {
  providerId: string;
  providerEmail: string;
  grossCents: number;
  providerShareCents: number;
  callCount: number;
  wouldPay: boolean;
  reason?: string;
};

export type PayoutPreview = {
  mode: 'dry-run';
  periodEnd: Date;
  providers: number;
  wouldPay: number;
  totalGrossCents: number;
  totalProviderShareCents: number;
  payableProviderShareCents: number;
  rows: PayoutPreviewRow[];
};

/**
 * Compute what a payout run WOULD do, writing nothing and calling Stripe not
 * at all.
 *
 * The route's previous dry-run returned a sentence and no numbers, which made
 * it useless for the one question worth asking before a payout: how much is
 * this about to send, and to whom. It also meant the two payout engines could
 * not be compared, since only one of them could produce figures.
 *
 * Deliberately does NOT call `stripe.accounts.retrieve`. A preview should work
 * with no Stripe keys configured, and the live run re-checks payout capability
 * against Stripe anyway. So `wouldPay` here is optimistic about Connect status:
 * it trusts the local `payoutsEnabled` flag rather than confirming it upstream.
 */
export async function previewAllPayouts(periodEnd: Date): Promise<PayoutPreview> {
  const providerAgents = await prisma.agent.findMany({
    where: { apiCalls: { some: { status: 'success' } }, native: false },
    select: { providerId: true },
    distinct: ['providerId'],
  });

  const rows: PayoutPreviewRow[] = [];
  let totalGrossCents = 0;
  let totalProviderShareCents = 0;
  let payableProviderShareCents = 0;
  let wouldPayCount = 0;

  for (const { providerId } of providerAgents) {
    const provider = await prisma.user.findUnique({
      where: { id: providerId },
      select: { id: true, email: true, stripeAccountId: true, payoutsEnabled: true },
    });
    if (!provider) continue;

    const { grossCents, callCount } = await aggregateProviderEarnings(providerId, periodEnd);
    const providerShareCents = Math.floor(grossCents * PROVIDER_SHARE);

    totalGrossCents += grossCents;
    totalProviderShareCents += providerShareCents;

    let wouldPay = true;
    let reason: string | undefined;

    if (grossCents === 0 || callCount === 0) {
      wouldPay = false; reason = 'no_earnings';
    } else if (providerShareCents < MIN_PAYOUT_CENTS) {
      wouldPay = false;
      reason = `below_minimum (needs ${MIN_PAYOUT_CENTS}c, has ${providerShareCents}c)`;
    } else if (!provider.stripeAccountId) {
      wouldPay = false; reason = 'no_stripe_account';
    } else if (!provider.payoutsEnabled) {
      wouldPay = false; reason = 'payouts_not_enabled';
    }

    if (wouldPay) { wouldPayCount++; payableProviderShareCents += providerShareCents; }

    rows.push({
      providerId, providerEmail: provider.email,
      grossCents, providerShareCents, callCount, wouldPay,
      ...(reason ? { reason } : {}),
    });
  }

  rows.sort((a, b) => b.providerShareCents - a.providerShareCents);

  return {
    mode: 'dry-run',
    periodEnd,
    providers: providerAgents.length,
    wouldPay: wouldPayCount,
    totalGrossCents,
    totalProviderShareCents,
    payableProviderShareCents,
    rows,
  };
}
