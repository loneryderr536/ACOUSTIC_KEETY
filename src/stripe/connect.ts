import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getStripe } from './client';

/**
 * Stripe Connect onboarding for providers.
 *
 * Merged from BigKahoona's `/api/stripe/connect` route and the standalone
 * service's `connectService.js`. Behaviour taken from each:
 *
 *  - Express accounts, country `au`, `business_type: individual` (BigKahoona —
 *    the live app already creates accounts this way and existing accounts must
 *    keep matching).
 *  - `card_payments` requested alongside `transfers` (standalone service —
 *    BigKahoona only requested transfers).
 *  - `chargesEnabled` / `payoutsEnabled` persisted, not just
 *    `onboardingComplete` (standalone service — the payout engine gates on
 *    these two and BigKahoona had nowhere to read them from).
 */

export function appUrl(originHeader?: string | null): string {
  const railwayDomain = process.env.RAILWAY_PUBLIC_DOMAIN;
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    (railwayDomain ? `https://${railwayDomain}` : null) ||
    originHeader ||
    'http://localhost:3000'
  );
}

export async function createConnectedAccount(user: {
  id: string;
  email: string;
}): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const account = await stripe.accounts.create({
    type: 'express',
    email: user.email,
    country: 'au',
    business_type: 'individual',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    metadata: { userId: user.id },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: { stripeAccountId: account.id },
  });

  return account.id;
}

/**
 * One-time onboarding link — like a checkout URL, but for identity/bank
 * verification. These expire within minutes, so always generate fresh and
 * never cache one.
 */
export async function createOnboardingLink(
  stripeAccountId: string,
  baseUrl: string,
): Promise<string> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const accountLink = await stripe.accountLinks.create({
    account: stripeAccountId,
    type: 'account_onboarding',
    refresh_url: `${baseUrl}/provider/dashboard?stripe=refresh`,
    return_url: `${baseUrl}/provider/dashboard?stripe=connected&accountId=${stripeAccountId}`,
  });

  return accountLink.url;
}

export type AccountStatus = {
  connected: boolean;
  onboardingComplete: boolean;
  readyToReceivePayments: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  accountId?: string;
};

/**
 * Ask Stripe directly whether this account can accept charges/payouts yet.
 * Never trust a locally cached flag for this — onboarding can complete or be
 * revoked without a webhook landing in time.
 */
export async function getAccountStatus(stripeAccountId: string): Promise<AccountStatus> {
  const stripe = getStripe();
  if (!stripe) throw new Error('Stripe not configured');

  const account = await stripe.accounts.retrieve(stripeAccountId);
  return accountStatusOf(account);
}

export function accountStatusOf(account: Stripe.Account): AccountStatus {
  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;

  return {
    connected: true,
    onboardingComplete: account.details_submitted === true,
    readyToReceivePayments: chargesEnabled && payoutsEnabled,
    chargesEnabled,
    payoutsEnabled,
    accountId: account.id,
  };
}

/**
 * Persist a Connect account's current state against whichever user owns it.
 * Called both opportunistically (status GET) and authoritatively (the
 * `account.updated` / `capability.updated` webhook).
 */
export async function syncAccountStatus(account: Stripe.Account): Promise<boolean> {
  const status = accountStatusOf(account);

  const result = await prisma.user.updateMany({
    where: { stripeAccountId: account.id },
    data: {
      chargesEnabled: status.chargesEnabled,
      payoutsEnabled: status.payoutsEnabled,
      onboardingComplete: status.onboardingComplete || status.readyToReceivePayments,
    },
  });

  if (result.count === 0) {
    console.warn(`[stripe-connect] account event for unknown Stripe account: ${account.id}`);
    return false;
  }
  return true;
}
