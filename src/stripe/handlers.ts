import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getPlanConfig } from '@/lib/plans';
import { getStripe } from './client';
import { planForPriceId } from './prices';
import { recordInvoiceRevenue } from './revenue';
import { syncAccountStatus } from './connect';

/**
 * Every webhook handler, in one file.
 *
 * This is BigKahoona's existing credit/plan logic (which was correct and
 * live) merged with the standalone service's handlers (which added the pieces
 * BigKahoona never had). Where the two disagreed, the live app's behaviour
 * wins — the standalone service was written against a `Consumer.currentTier`
 * string, whereas the live app also has to move `callsLimit`, `callsBalance`,
 * `dailyAllowance` and `dailyCeiling` in step with the plan.
 *
 * Added from the standalone service:
 *   - deposit branch on `checkout.session.completed` (mode === 'payment')
 *   - `customer.subscription.created` handled alongside `.updated`
 *   - plan resync from the subscription's Price ID, not just the stored plan
 *   - RevenuePeriod accumulation on `invoice.paid`
 *   - `capability.updated` -> full account fetch -> same sync path
 *   - `transfer.created` / `transfer.failed` reconciliation against Payout
 *   - `charge.dispute.created` recorded rather than dropped
 */

async function applyPlan(userId: string, planKey: string, extra: Record<string, unknown> = {}) {
  const cfg = getPlanConfig(planKey);
  await prisma.user.update({
    where: { id: userId },
    data: {
      plan: planKey,
      callsLimit: cfg.callsLimit,
      callsBalance: cfg.callsLimit,
      dailyAllowance: cfg.dailyAllowance,
      dailyCeiling: cfg.dailyCeiling,
      ...extra,
    },
  });
}

// ── checkout.session.completed ────────────────────────────────────────────
// The one place a subscription is actually confirmed. Never trust the
// frontend redirect for this.
export async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  // Branch on mode — a one-off payment here is the provider listing deposit,
  // not a plan purchase.
  if (session.mode === 'payment') {
    return handleDepositPaid(session);
  }

  const userId = session.metadata?.userId ?? session.client_reference_id ?? undefined;
  const planKey = session.metadata?.plan;

  if (!userId || !planKey) {
    console.error('[stripe] checkout.session.completed missing metadata:', { userId, planKey });
    return;
  }

  await applyPlan(userId, planKey, { stripeCustomerId: session.customer as string });
  console.log(`[stripe] User ${userId} upgraded to ${planKey}`);
}

// ── the $49 provider listing deposit ──────────────────────────────────────
export async function handleDepositPaid(session: Stripe.Checkout.Session) {
  const providerId = session.metadata?.providerId ?? session.client_reference_id ?? undefined;
  const purpose = session.metadata?.purpose;
  const agentId = session.metadata?.agentId;

  if (purpose !== 'listing_deposit' || !providerId) {
    console.warn('[stripe] one-time checkout.session.completed with unexpected metadata:', session.id);
    return;
  }

  await prisma.user.update({
    where: { id: providerId },
    data: { depositPaid: true },
  });

  // If the deposit was raised against a specific listing, stamp the agent too —
  // these columns existed in BigKahoona but nothing ever wrote to them.
  if (agentId) {
    await prisma.agent.updateMany({
      where: { id: agentId },
      data: {
        depositPaymentIntentId: (session.payment_intent as string) ?? null,
        depositStatus: 'paid',
        depositPaidAt: new Date(),
      },
    });
  }

  console.log(`[stripe] Listing deposit paid by provider ${providerId}`);
}

// ── customer.subscription.created / .updated ──────────────────────────────
export async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) {
    console.warn('[stripe] subscription event for unknown Stripe customer:', customerId);
    return;
  }

  if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
    await applyPlan(user.id, 'recruit');
    console.log(`[stripe] Subscription ${subscription.status} for user ${user.id}, downgraded to recruit`);
    return;
  }

  if (subscription.status === 'active') {
    // Prefer the plan the Price ID says, so a change made in the Billing Portal
    // is picked up rather than silently re-applying the stored plan.
    const priceId = subscription.items?.data?.[0]?.price?.id;
    const planFromPrice = planForPriceId(priceId);
    const planKey = planFromPrice ?? user.plan;

    if (!planFromPrice && priceId) {
      console.warn('[stripe] subscription updated with unrecognized price id:', priceId);
    }

    await applyPlan(user.id, planKey);
    console.log(`[stripe] Subscription active for user ${user.id}, plan ${planKey} (price ${priceId})`);
  }
}

// ── customer.subscription.deleted ─────────────────────────────────────────
export async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const stripe = getStripe();
  const customerId = subscription.customer as string;

  // Upgrade scenario: the old sub is cancelled but a new one is already active.
  // Don't downgrade in that case.
  if (stripe) {
    const remaining = await stripe.subscriptions.list({ customer: customerId, status: 'active', limit: 1 });
    if (remaining.data.length > 0) {
      console.log(`[stripe] Subscription cancelled for ${customerId}, another active sub exists — skipping downgrade`);
      return;
    }
  }

  const cfg = getPlanConfig('recruit');
  await prisma.user.updateMany({
    where: { stripeCustomerId: customerId },
    data: {
      plan: 'recruit',
      callsLimit: cfg.callsLimit,
      callsBalance: cfg.callsLimit,
      dailyAllowance: cfg.dailyAllowance,
      dailyCeiling: cfg.dailyCeiling,
    },
  });
  console.log(`[stripe] Subscription cancelled for customer ${customerId}, downgraded to recruit`);
}

// ── invoice.paid / invoice.payment_succeeded ──────────────────────────────
export async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // Accumulate into the period revenue pool FIRST — this happens for every
  // paid invoice including the first, and is independent of credit resets.
  const split = await recordInvoiceRevenue(invoice);
  console.log(
    `[stripe] Revenue recorded for ${split.periodKey}: +${split.subscriptionCents}c subscription, +${split.overageCents}c overage`,
  );

  const customerId = invoice.customer as string;
  const billingReason = invoice.billing_reason as string | null | undefined;

  // `subscription_create` is the first-period invoice — checkout.session.completed
  // already set callsBalance. Only reset on renewals and manual top-ups.
  if (billingReason === 'subscription_create') return;

  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) {
    console.warn('[stripe] invoice.paid for unknown Stripe customer:', customerId);
    return;
  }

  const cfg = getPlanConfig(user.plan);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      callsLimit: cfg.callsLimit,
      callsBalance: cfg.callsLimit,
      callsUsed: 0,
      dailyAllowance: cfg.dailyAllowance,
      dailyCeiling: cfg.dailyCeiling,
      lastReplenishAt: new Date(),
    },
  });
  console.log(`[stripe] Invoice paid for user ${user.id} (${billingReason ?? 'unknown'}), credits reset to ${cfg.callsLimit}`);
}

// ── invoice.payment_failed ────────────────────────────────────────────────
export async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  const user = await prisma.user.findFirst({ where: { stripeCustomerId: customerId } });
  if (!user) {
    console.warn('[stripe] invoice.payment_failed for unknown Stripe customer:', customerId);
    return;
  }

  await applyPlan(user.id, 'recruit');
  console.warn(`[stripe] Payment FAILED for user ${user.id} (${user.email}) — invoice ${invoice.id}, downgraded to recruit`);
}

// ── account.updated ───────────────────────────────────────────────────────
export async function handleAccountUpdated(account: Stripe.Account) {
  await syncAccountStatus(account);
}

// ── capability.updated ────────────────────────────────────────────────────
// The payload is a Capability, not an Account — it doesn't carry
// charges_enabled/payouts_enabled, so fetch the full account and reuse the
// same sync path.
export async function handleCapabilityUpdated(capability: Stripe.Capability) {
  const stripe = getStripe();
  if (!stripe) return;
  const accountId = typeof capability.account === 'string' ? capability.account : capability.account?.id;
  if (!accountId) return;
  const account = await stripe.accounts.retrieve(accountId);
  await syncAccountStatus(account);
}

// ── transfer.created / transfer.updated / transfer.reversed ───────────────
// Was a TODO in the standalone service: Stripe's own async confirmation never
// reconciled back against the ledger. It does now.
//
// NOTE: the standalone service's checklist planned for `transfer.failed`.
// That event does not exist — Stripe only emits `transfer.created`,
// `transfer.updated` and `transfer.reversed`. A transfer that comes back
// surfaces as a reversal, so that is what marks a payout failed here.
export async function handleTransferEvent(
  transfer: Stripe.Transfer,
  eventType: 'transfer.created' | 'transfer.updated' | 'transfer.reversed',
) {
  const reversed = eventType === 'transfer.reversed' || (transfer.amount_reversed ?? 0) > 0;
  const status = reversed ? 'failed' : 'paid';

  const updated = await prisma.payout.updateMany({
    where: { stripeTransferId: transfer.id },
    data: {
      status,
      ...(reversed
        ? { failureReason: `stripe reported ${eventType} (amount_reversed=${transfer.amount_reversed ?? 0})` }
        : { paidAt: new Date() }),
    },
  });

  if (updated.count === 0) {
    // Fall back to the metadata we set when creating the transfer.
    const providerId = transfer.metadata?.providerId;
    const periodKey = transfer.metadata?.periodKey;
    console.warn(
      `[stripe] ${eventType} for transfer ${transfer.id} matched no Payout row (providerId=${providerId}, periodKey=${periodKey})`,
    );
    return;
  }

  console.log(`[stripe] ${eventType} reconciled against ${updated.count} payout row(s)`);
}

// ── charge.dispute.created ────────────────────────────────────────────────
// Does not yet feed the reserve calculation — that is still open work. It is
// at least recorded now rather than logged and dropped.
export async function handleDisputeCreated(dispute: Stripe.Dispute) {
  console.warn(
    `[stripe] DISPUTE opened: ${dispute.id} amount=${dispute.amount} reason=${dispute.reason} charge=${String(dispute.charge)}`,
  );
  // TODO: feed disputed amounts into RESERVE_PCT in monthly-payout.ts.
}
