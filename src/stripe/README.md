# `src/stripe/` — the whole Stripe integration

Everything payments-related lives here. Routes under `src/app/api/stripe/*` and
`src/app/api/admin/payout*` are thin wrappers that validate and delegate into
this folder.

```
client.ts          Stripe SDK singleton + PAYOUT_CURRENCY
period.ts          "YYYY-MM" period keys and their UTC bounds
prices.ts          Price ID <-> plan mapping (accepts both env naming schemes)
events.ts          Webhook dedup (WebhookEvent table)
revenue.ts         Invoice -> subscription/overage split -> RevenuePeriod
checkout.ts        Subscription checkout + billing portal
connect.ts         Connect account create / onboarding link / status sync
deposits.ts        Provider listing deposit ($49, one-off)
usage.ts           periodKey stamping + backfill for ApiCall
payouts.ts         Rolling per-provider engine (LIVE today)
monthly-payout.ts  Monthly revenue-pool engine (ported from Stripe/)
handlers.ts        Every webhook handler
index.ts           Barrel — import from '@/stripe'
```

`src/lib/stripe.ts` and `src/lib/payouts.ts` are now one-line re-export shims,
so nothing that imported them had to change.

---

## Where this came from

This folder is the merge of two implementations: the standalone `Stripe/`
Express service, and the Stripe code that was already live in this repo. The
live code was ahead on subscriptions and credits; the standalone service was
ahead on revenue accounting, deposits and payout splitting. Both are here.

### The four conflicts, and how each was resolved

**1. Prisma model collision on `Agent`.** Both schemas declared `model Agent`
with different shapes. Rather than rename one, the standalone service's
duplicate data model was dropped and its *logic* remapped onto the models this
repo already has:

| standalone | here |
|---|---|
| `Provider` | `User` (role `provider`) |
| `Consumer` | `User` (subscriber) |
| `UsageEvent` | `ApiCall` (`weight` -> `creditsConsumed`) |
| `PayoutLedger` | `Payout` |
| `Agent.suspended` | `Agent.status === 'suspended'` |
| `Provider.stripeConnectedAccountId` | `User.stripeAccountId` |

Only two genuinely new tables were added — `WebhookEvent` and `RevenuePeriod` —
plus columns: `User.chargesEnabled`, `User.payoutsEnabled`, `User.depositPaid`,
`Agent.native`, `ApiCall.periodKey`, and `Payout.periodKey`/`weightedCalls`/
`sharePct`.

**2. Express -> Next.js.** Nothing was copied; every route was rewritten as an
App Router handler. `express.raw()` ordering is gone — `request.text()` gives
the raw body signature verification needs, and there is no global JSON parser to
work around.

**3. Prisma 5.19 -> 7.7.** The standalone service constructed its own bare
`new PrismaClient()`; this repo uses the `@prisma/adapter-pg` driver adapter via
the `@/lib/prisma` singleton. Everything here imports that singleton.

**4. stripe 16.8 -> 22.0.** Two concrete fixes:
- The pinned `apiVersion: '2024-06-20'` is gone — stripe@22's types reject it.
- `revenue.ts` reads invoice line prices from **both** `pricing.price_details.price`
  (API 2025-04-30+, what stripe@22 speaks) and legacy `price.id`. The old code
  read only the latter, which on stripe@22 returns `undefined` rather than
  throwing — every overage line would have been silently miscounted as
  subscription revenue and skewed every payout downstream.

### Two latent bugs in the original, fixed on the way in

- `payoutService.js` upserted on `providerId_periodKey`, a compound unique its
  own schema never declared (the schema's unique was `[providerId, periodStart]`).
  Every write would have thrown. `monthly-payout.ts` uses `Payout`'s real
  `@@unique([providerId, periodEnd])`, with `periodEnd` derived from the period key.
- Its `create` payloads never supplied `periodStart`/`periodEnd`, both non-null.
  Both are supplied now.

---

## Two payout engines, on purpose

They answer different questions and both are kept:

- **`payouts.ts` — `runAllPayouts(periodEnd)`**, `POST /api/admin/payouts`.
  Pays each provider what they've accrued since their last reconciled boundary,
  straight from `ApiCall.creditsConsumed`. This is what runs on Railway today.
- **`monthly-payout.ts` — `runMonthlyPayout("2026-07")`**, `POST /api/admin/payout-run`.
  Splits a fixed revenue pool for one calendar month: native share retained
  first, then 65/35 on subscription revenue and 50/50 on overage, quality
  multiplier by rating, reserve held back, under-threshold amounts carried
  forward. Algorithm preserved exactly from the standalone service.

Do not run both against the same period without deciding which one owns it —
they write to the same `Payout` table.

---

## Still open

- `RESERVE_PCT` (5%) and `MIN_PAYOUT_THRESHOLD_CENTS` are still guesses. The
  threshold defaults to $50 here, matching what `/terms` and `/reference` tell
  customers, not the standalone service's $5.
- `STRIPE_PAYOUT_CURRENCY` defaults to `usd` (current live behaviour). Connected
  accounts are created with `country: 'au'`, and the standalone service sent
  `aud`. Someone has to decide.
- Reserve release: money held back is never released to providers later. No job
  exists.
- Carried-forward amounts appear in the run summary and are then forgotten —
  next month has no memory of a provider being owed a small leftover.
- `charge.dispute.created` is recorded but does not yet feed reserve logic.
- `PLATFORM_USER_ID` must point at a real `User` row for the `retained_native`
  reporting row to be written; unset, that row is skipped and the run says so.
- Neither engine has been run against real Postgres + real Stripe together.
