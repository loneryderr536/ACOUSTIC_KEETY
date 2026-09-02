import type Stripe from 'stripe';
import { getStripe } from './client';
import { priceIdForPlan } from './prices';
import { resolvePlan } from '@/lib/plans';

/**
 * Subscription checkout.
 *
 * BigKahoona's route body, lifted here so the route file becomes a thin
 * validate-and-delegate wrapper (the pattern the standalone service's
 * `admin.js` comment argues for). Two things carried over from the standalone
 * service's `stripeService.js`:
 *
 *  - `client_reference_id` is set as well as metadata, so a session can be
 *    traced back to a user in the Stripe Dashboard without opening metadata.
 *  - Success URL carries `{CHECKOUT_SESSION_ID}` for the same reason.
 */
export type CheckoutInput = {
  user: { id: string; email: string; plan: string; stripeCustomerId: string | null };
  plan: string;
  baseUrl: string;
};

export type CheckoutOutcome =
  | { ok: true; url: string | null }
  | { ok: false; status: number; error: string };

export async function createSubscriptionCheckout(
  input: CheckoutInput,
): Promise<CheckoutOutcome> {
  const stripe = getStripe();
  if (!stripe) {
    return { ok: false, status: 503, error: 'Payments are not currently available. Please try again later.' };
  }

  const { user, plan, baseUrl } = input;
  const resolvedPlan = resolvePlan(plan);
  const priceId = priceIdForPlan(resolvedPlan);

  if (!priceId) {
    const known = ['field_agent', 'double_0', 'shadow'].includes(resolvedPlan);
    return {
      ok: false,
      status: 400,
      error: known ? 'Price not configured for this plan yet' : 'Invalid plan',
    };
  }

  if (user.plan === resolvedPlan) {
    return { ok: false, status: 409, error: `You are already on the ${resolvedPlan} plan` };
  }

  // Cancel any existing active subscription first, so an upgrade doesn't leave
  // the customer billed twice.
  if (user.stripeCustomerId) {
    try {
      const subs = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
      });
      for (const sub of subs.data) {
        await stripe.subscriptions.cancel(sub.id, { prorate: true });
      }
    } catch (err) {
      console.error('[stripe] Failed to cancel existing subscriptions:', err);
    }
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { userId: user.id, plan: resolvedPlan },
    success_url: `${baseUrl}/dashboard?upgraded=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pricing`,
  };

  if (user.stripeCustomerId) {
    params.customer = user.stripeCustomerId;
  } else {
    params.customer_email = user.email;
  }

  try {
    const session = await stripe.checkout.sessions.create(params);
    return { ok: true, url: session.url };
  } catch (err) {
    console.error('[stripe] Checkout session creation failed:', err);
    return { ok: false, status: 500, error: 'Failed to create checkout session' };
  }
}

export async function createPortalSession(
  stripeCustomerId: string,
  baseUrl: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const session = await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${baseUrl}/dashboard`,
  });

  return session.url;
}
