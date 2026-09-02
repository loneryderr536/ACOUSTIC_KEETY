# Pipeline Audit — 2026-04-23

**What this is:** empirical end-to-end test of the subscriber → agent → provider → payout pipeline against production (`acoustickitty.ai`). Findings, fixes shipped this session, and what's still broken.

---

## Test method

1. Bootstrapped a throwaway subscriber via the (currently public) `POST /api/subscribers/register` endpoint.
2. Exercised `POST /api/v1/run` with two shapes: `routing=specific` against a named agent, and `routing=performance` with a category filter.
3. Bootstrapped a throwaway provider via `POST /api/providers/register`.
4. Attempted to register an agent via `POST /api/agents` against `httpbin.org/anything` (expected 422 from endpoint-contract validator).
5. Inspected `GET /api/dashboard/stats`, `GET /api/dashboard/calls`, and `GET /api/provider/stats` to verify attribution.
6. Read every route in `src/app/api/**` plus `src/lib/router.ts`, `src/lib/plans.ts`, `src/lib/validation.ts`, and the Prisma schema to trace data flow beyond what HTTP can show.

---

## What works end-to-end

- **Subscriber registration** (`POST /api/subscribers/register`) issues an API key with a valid plan and balance
- **Subscriber auth** (`/api/v1/run`) accepts API key via `Authorization: Bearer`, rejects missing/bad headers with 401
- **Agent routing** (specific-by-slug mode) resolves the agent, applies call weight, decrements balance, proxies to the agent's `/tasks` endpoint, and returns the response with `X-RateLimit-Remaining` and `X-Call-Weight` headers
- **Call logging** (`ApiCall` rows) records subscriber ID, agent ID, latency, status, routing strategy, cost, request/response sizes
- **Subscriber dashboard stats** (`/api/dashboard/stats`, `/api/dashboard/calls`) correctly reflect calls made and balance remaining
- **Atomic balance decrement** — uses `updateMany` with a balance-gte predicate so concurrent calls can't double-spend
- **Burst rate limiting** (Redis, per-minute + per-hour) is wired in before the proxy
- **Provider role enforcement** — subscriber API keys get 403 on `POST /api/agents` as expected
- **Agent endpoint contract validation** — `POST /api/agents` refuses endpoints that don't return the required `/health`, `/tasks`, `/skills` shapes
- **SSRF protection** on subscriber `callback_url` and provider `endpointUrl`
- **Stripe subscription checkout + webhook** (upgrade on checkout.session.completed, downgrade on past_due / invoice.payment_failed / subscription.deleted)
- **Stripe Connect account creation + onboarding link**

---

## What's broken — fixed this session

### P0-1: Routing without a category was Russian roulette

**Reproduction:**
```bash
curl -X POST https://acoustickitty.ai/api/v1/run \
  -H "Authorization: Bearer <key>" \
  -d '{"task":"hi","routing":"performance"}'
```
Response: routed to **NRL Footy Tips**. The agent responded with a rugby league assistant greeting.

**Why it happened:** `resolveAgent` in `src/lib/router.ts` under `routing=performance` with no `category` sorts all active agents by `currentScore DESC` and returns the first one. All 7 production agents have `currentScore = null` (PENDING), so ORDER BY is effectively insertion order — the user gets whichever agent was seeded first.

**Fix (commit to ship below):** `runAgentSchema` in `src/lib/validation.ts` now refines with `agent || category` required. A generic task with no specialization context returns 400:

> "Provide either 'agent' (specific slug) or 'category'. Acoustic Kitty agents are specialists — we don't route generic tasks to random agents."

**Follow-up (not this session):** within a category, there's still a mismatch problem — asking a wedding planner for a haiku works but the agent stays in character. The real fix is either (a) Haiku-classifier intent routing (matches what the Telegram gateway already does) or (b) per-agent skill tags that filter routing. Out of scope for the cleanup session. Flagged for Plan 3.

### P0-2: Failed calls billed the subscriber

**Reproduction:** if the primary agent and all fallbacks 500 or time out, the atomic balance decrement at line 76 of `/api/v1/run/route.ts` has already happened. The user pays for nothing.

**Fix:** if `result.status !== 'success'` after all fallback attempts, restore `callsBalance` and decrement `callsUsed` back by the call weight, and log the call with `costCents = 0` so provider earnings aren't credited either. The failed call is still logged for telemetry.

### P0-3: Provider earnings display was misleading

**Reproduction:** `GET /api/provider/stats` returned `totalRevenue` as `SUM(ApiCall.costCents)` including failed calls, with zero platform-fee adjustment. A provider with 1000 successful calls at `pricePerCall=20` would see "totalRevenue: $200" when actual earnings under the 65/35 split are $130 (and of that, only the portion above $50 is paid out).

**Fix:** `provider/stats` route rewritten to:
- Only count `status=success` calls in the earnings aggregate
- Apply the 65% provider share server-side
- Return `earnings: { grossCents, providerShareCents, note }` with an explicit payout-reconciliation note
- Keep legacy `totalRevenue` field for existing UI callers, but it now holds the post-split provider share — not gross
- Add `weightedCalls` (successful calls × model tier weight) for future payout-pool math

### P0-4: Provider endpoint contract was documented nowhere

**Reproduction:** `POST /api/agents` against an endpoint that doesn't implement `/health`, `/tasks`, `/skills` returns a 422 with the list of required response shapes. There's no way to discover this contract before hitting the error. The teardown already flagged this; live testing confirmed it.

**Fix:** new section in `/reference` — `#provider-contract` — documents each required endpoint, its purpose, required response shape, request/response example JSON for `/tasks`, auth token handling, and the circuit-breaker behaviour on sustained failure.

---

## What's still broken — NOT fixed this session

### Architectural: no automated payout pipeline

No code in the repo calls `stripe.transfers.create`. Provider payouts happen manually — someone has to query the database, calculate earnings, and initiate transfers by hand. The `ProviderDashboardClient` even says: *"Stripe Connect is coming soon. During beta, payouts are not yet processed."*

**Minimum to fix:**
1. New `Payout` table: `id, providerId, periodStart, periodEnd, grossCents, providerShareCents, status, stripeTransferId, createdAt, paidAt`
2. Admin-gated endpoint `POST /api/admin/payouts/run` that aggregates unpaid successful-call earnings per provider, creates Stripe Transfers, writes Payout rows
3. Guard: providers with `stripeAccountId = null` or `payouts_enabled = false` skipped
4. Surface payout history on provider dashboard

Estimated effort: 4-6 hours. Not blocking launch but blocking any provider from earning a single dollar beyond a founder's personal Stripe dashboard.

### Architectural: no automated benchmarking

`POST /api/agents` creates agents in `status: 'pending'`. Nothing ever transitions them to `benchmarking` or `active` programmatically. The workflow is: register → admin runs `POST /api/admin/activate-agents` manually → agent is live. The response message "It will be benchmarked before going live" is aspirational.

**Minimum to fix (still Plan 3):** category-keyed test batteries, Opus-as-judge, score storage, scheduled runner. Pre-approved spec outlined in post-honesty-pass teardown.

### Security: registration endpoints are open

- `POST /api/subscribers/register` — no rate limit, no email verification, no auth required. Anyone can flood the DB with accounts.
- `POST /api/providers/register` — same. And creates an API key every time.

**Minimum fix:** IP rate limit (Redis), Turnstile/hCaptcha on the web form, email verification before API key activation.

### Provider account mixing

Providers and subscribers share the same `User` table with a single `role` field. A provider can ALSO call agents — I confirmed this with a fresh provider whose free-tier balance let them run a call. This may be intentional (dogfooding) but there's no clear UX telling a provider what their consumer-side balance even is, since the provider dashboard shows only provider stats.

Decision needed: separate balance models for subscriber vs provider identities, or keep the shared role and document dogfooding explicitly.

### Semantic ambiguity: what is `costCents`

`ApiCall.costCents` is stored as `agent.pricePerCall` (20¢ by default). But:
- Subscriber didn't pay 20¢ for that call — they paid a flat monthly fee ($19 / 5000 calls = ~$0.004/call)
- Provider doesn't earn 20¢ — they earn 65% of some pool at month-end

The field is a display price, not a cash-flow number. Today's `provider/stats` fix applies the 65% split to `costCents` as a provisional estimate, but the real number at payout time is the subscription-revenue pool × (provider's weighted calls / all-providers weighted calls), not `costCents × 65%`. The numbers approximately converge only if every subscriber uses their full call allowance exactly.

**Long-term:** replace `costCents` with either (a) a pool-distribution math at payout time, or (b) make it actually mean the per-call list price and charge subscribers accordingly (per-call billing with auto-upgrade thresholds).

### Minor: audit provider's own call balance

When a provider account makes calls, those calls decrement the provider's `callsBalance` and increment `callsUsed` — but the provider dashboard shows provider-role stats (agents, earnings) and not their subscriber-side balance. Providers won't know they've hit their limit until they get a 429.

---

## Verification

After shipping today's fixes, rerun the same live test:

```bash
# should 400 — can't route without a category
curl -X POST https://acoustickitty.ai/api/v1/run \
  -H "Authorization: Bearer <key>" \
  -d '{"task":"hi","routing":"performance"}'

# should succeed — category given
curl -X POST https://acoustickitty.ai/api/v1/run \
  -H "Authorization: Bearer <key>" \
  -d '{"task":"Summarize a short article","category":"research","routing":"performance"}'

# provider stats now reflects 65% share
curl https://acoustickitty.ai/api/provider/stats \
  -H "Authorization: Bearer <provider-key>"
```

---

## Commits in this session

- `bf44d64` — Plan 1 honesty pass
- `ca86b48` — `/link` QR for unsigned users
- `31ba292` — PENDING score UX + nav relabel
- `429037f` — Idempotency + webhook sigs "COMING SOON" banners
- `f26a903` — Post-honesty-pass teardown document
- `5d79add` — QR desktop fallback (Telegram Web)
- `8390657` — Cookie banner AK-aesthetic redesign + final `$HOA_API_KEY` sweep
- **next** — pipeline audit fixes (this doc + routing schema + failed-call refund + provider earnings + provider contract docs)
