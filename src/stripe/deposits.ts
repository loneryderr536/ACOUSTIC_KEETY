import { prisma } from '@/lib/prisma';
import { getStripe } from './client';
import { depositPriceId } from './prices';

/**
 * Provider listing deposit — the one-off $49 charge.
 *
 * Ported wholesale from the standalone service's `depositService.js` +
 * `routes/deposits.js`. BigKahoona had the *columns* for this
 * (`Agent.depositPaymentIntentId`, `depositStatus`, `depositPaidAt`) but no
 * route that ever set them, so the flow existed on paper only.
 *
 * `mode: 'payment'` rather than `'subscription'` is what the webhook handler
 * branches on to tell a deposit apart from a plan purchase — keep it.
 */
export type DepositOutcome =
  | { ok: true; url: string | null }
  | { ok: false; status: number; error: string };

export async function createDepositCheckout(params: {
  userId: string;
  email: string;
  agentId?: string;
  baseUrl: string;
}): Promise<DepositOutcome> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, status: 503, error: 'Payments are not currently available.' };
  }

  const priceId = depositPriceId();
  if (!priceId) {
    return { ok: false, status: 400, error: 'Listing deposit price is not configured' };
  }

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, depositPaid: true },
  });
  if (!user) {
    return { ok: false, status: 404, error: 'Provider not found' };
  }
  if (user.depositPaid) {
    return { ok: false, status: 400, error: 'Deposit already paid for this provider' };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer_email: params.email,
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: params.userId,
      metadata: {
        providerId: params.userId,
        purpose: 'listing_deposit',
        ...(params.agentId ? { agentId: params.agentId } : {}),
      },
      success_url: `${params.baseUrl}/provider/dashboard?deposit=paid`,
      cancel_url: `${params.baseUrl}/provider/dashboard?deposit=cancelled`,
    });

    return { ok: true, url: session.url };
  } catch (err) {
    console.error('[stripe] Deposit checkout creation failed:', err);
    return { ok: false, status: 500, error: 'Failed to create deposit checkout session' };
  }
}
