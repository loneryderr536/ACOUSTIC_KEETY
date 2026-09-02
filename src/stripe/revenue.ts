import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { PAYOUT_CURRENCY } from './client';
import { currentPeriodKey } from './period';
import { overagePriceIds } from './prices';

/**
 * Reads the Price ID off an invoice line item, tolerating both API shapes.
 *
 * CONFLICT FIX (the silent one). The standalone service ran stripe@16 and read
 * `line.price.id`. Stripe removed `price` from invoice line items in API
 * version 2025-04-30 and replaced it with `pricing.price_details.price`, and
 * that is the shape stripe@22 speaks. The old code would not have thrown — it
 * would have returned `undefined` for every line, quietly classifying 100% of
 * overage revenue as subscription revenue and skewing every payout that
 * followed. Reading both shapes keeps old and new deliveries correct.
 */
function lineItemPriceId(line: Stripe.InvoiceLineItem): string | null {
  const l = line as unknown as {
    price?: { id?: string | null } | null;
    pricing?: { price_details?: { price?: string | null } | null } | null;
  };
  return l.pricing?.price_details?.price ?? l.price?.id ?? null;
}

export type RevenueSplit = { subscriptionCents: number; overageCents: number };

/** Split a paid invoice into subscription vs overage cents. */
export function splitInvoiceRevenue(invoice: Stripe.Invoice): RevenueSplit {
  const overage = new Set(overagePriceIds());

  let subscriptionCents = 0;
  let overageCents = 0;

  for (const line of invoice.lines?.data ?? []) {
    const priceId = lineItemPriceId(line);
    if (priceId && overage.has(priceId)) {
      overageCents += line.amount;
    } else {
      subscriptionCents += line.amount;
    }
  }

  return { subscriptionCents, overageCents };
}

/**
 * Accumulate a paid invoice into the period's RevenuePeriod row.
 *
 * This is the pool `runMonthlyPayout` later distributes. Nothing in BigKahoona
 * tracked it before — the live app knew what each subscriber paid, but never
 * accumulated it per period, so there was no pool figure to split.
 *
 * ── Why this is idempotent per INVOICE, not per event ──────────────────────
 *
 * Found by testing a real $19 checkout: the pool came out at 3800c, exactly
 * double. Stripe fires BOTH `invoice.paid` and `invoice.payment_succeeded` for
 * the same invoice. Those are two distinct events with distinct event ids, so
 * the WebhookEvent dedup table correctly let both through — and both reach this
 * function.
 *
 * Everything else in the webhook handlers is naturally idempotent because it
 * SETS values (plan, callsLimit, callsBalance). This function INCREMENTS, so
 * running it twice doubles the payout pool and would have paid every provider
 * twice what they earned.
 *
 * Event-level dedup cannot fix this — the events are genuinely different. The
 * invoice is the thing that must be counted once, so `RevenueInvoice` records
 * which invoices have been folded in. The insert and the increment share one
 * transaction: if the invoice was already counted the insert violates the
 * primary key, the whole transaction rolls back, and the pool is untouched.
 */
export async function recordInvoiceRevenue(
  invoice: Stripe.Invoice,
  at: Date = new Date(),
): Promise<RevenueSplit & { periodKey: string; alreadyCounted: boolean; pooled: boolean }> {
  const { subscriptionCents, overageCents } = splitInvoiceRevenue(invoice);
  const periodKey = currentPeriodKey(at);
  const currency = (invoice.currency ?? PAYOUT_CURRENCY).toLowerCase();

  // ── Currency guard ──────────────────────────────────────────────────────
  //
  // A period's pool is a plain integer with one currency behind it. Stripe's
  // Adaptive Pricing can bill a customer in their own local currency, which
  // makes `line.amount` mean something entirely different — an A$19 plan paid
  // in INR arrives as 133689, not 1900. Summed blindly that inflates the
  // provider pool ~17x, and the payout engine then tries to transfer money that
  // does not exist.
  //
  // So a mismatched invoice is recorded but NOT pooled. The money is real and
  // the row is kept for reconciliation; it simply cannot be added to a total
  // denominated in something else. The payout run reports any such rows rather
  // than letting a period quietly under-report.
  if (currency !== PAYOUT_CURRENCY) {
    console.error(
      `[stripe] invoice ${invoice.id} billed in ${currency.toUpperCase()} but settlement is ` +
        `${PAYOUT_CURRENCY.toUpperCase()} — recorded but NOT pooled. Check whether Adaptive Pricing is enabled.`,
    );
    if (invoice.id) {
      await prisma.revenueInvoice
        .create({
          data: { id: invoice.id, periodKey, currency, subscriptionCents, overageCents, pooled: false },
        })
        .catch(() => {/* already recorded */});
    }
    return { periodKey, subscriptionCents: 0, overageCents: 0, alreadyCounted: false, pooled: false };
  }

  const invoiceId = invoice.id;
  if (!invoiceId) {
    // No invoice id to key on — count it rather than lose the revenue, and say
    // so loudly, because this path cannot be made idempotent.
    console.warn('[stripe] paid invoice with no id — counting without dedup protection');
    await prisma.revenuePeriod.upsert({
      where: { periodKey },
      update: {
        subscriptionCents: { increment: subscriptionCents },
        overageCents: { increment: overageCents },
      },
      create: { periodKey, subscriptionCents, overageCents },
    });
    return { periodKey, subscriptionCents, overageCents, alreadyCounted: false, pooled: true };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Throws on the second delivery — primary key is the Stripe invoice id.
      await tx.revenueInvoice.create({
        data: { id: invoiceId, periodKey, currency, subscriptionCents, overageCents, pooled: true },
      });

      await tx.revenuePeriod.upsert({
        where: { periodKey },
        update: {
          subscriptionCents: { increment: subscriptionCents },
          overageCents: { increment: overageCents },
        },
        create: { periodKey, currency, subscriptionCents, overageCents },
      });
    });
  } catch (err) {
    // P2002 = unique constraint violation = this invoice is already in the pool.
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      console.log(`[stripe] invoice ${invoiceId} already counted for ${periodKey} — skipping`);
      return { periodKey, subscriptionCents: 0, overageCents: 0, alreadyCounted: true, pooled: true };
    }
    throw err;
  }

  return { periodKey, subscriptionCents, overageCents, alreadyCounted: false, pooled: true };
}
