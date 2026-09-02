import Stripe from 'stripe';

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
