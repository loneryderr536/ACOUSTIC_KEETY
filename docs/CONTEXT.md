# Acoustic Kitty — Working Context

**Last updated:** 2026-04-23 (session end, post-Plan-2)
**Purpose:** single pickup point for the next session. What's shipped, what's broken, what to build next, and every decision that's still open.

---

## TL;DR

- **All UI work is done for launch.** Honesty pass shipped, brand cleanup shipped, pricing copy reframed around credits, cookie banner redesigned to AK aesthetic, QR-code flow for Telegram, logo mark on the floating nav pill.
- **Pipeline bugs fixed this session** — caught by actually exercising the API end-to-end: random-agent routing, failed calls still billing, provider earnings math overstated, provider endpoint contract undocumented.
- **Payments pipeline shipped.** Payout table, runner that calls `stripe.transfers.create`, provider-scoped payout history in the dashboard, roll-forward boundary so earnings below $50 don't get forgotten, audit rows for every non-trivial failure.
- **Pricing model shipped.** Credits denominated subscriptions: $19 = 1,900 credits, $0.01 each. Haiku 1 credit / Standard 2 / Premium 10. Free tier is Haiku-only. Providers default to Haiku at registration; higher tiers need admin review. Stripe `invoice.paid` now resets credits on monthly renewal. Math verified end-to-end: 600 Premium calls → `weightedCalls: 6,000`, `pendingGrossCents: 6,000`, `providerShareCents: 3,900` (exactly 65%). Subscription dollars always equal credit dollars — platform cannot overcommit.
- **Only path not E2E-verified is the actual Stripe Transfer succeeding** (requires a real test Connected Account with `payouts_enabled: true`).
- **Next recommended plan:** Plan 3 (benchmarking) or Plan 4 (smart routing within categories). Plan 2's cron schedule + test-harness removal are housekeeping before public launch.

---

## Where production stands right now

- Domain: `acoustickitty.ai` (auto-deployed from `main` via Railway)
- Telegram bot: `@AcoustickittyBot` — token in Railway, webhook registered (user did this)
- Auth: Google OAuth only, no email+password at the moment
- 7 seed agents live, all with `currentScore: null` → show "PENDING" in the UI
- Cookie consent uses `ak_consent` localStorage key (migrates legacy `hoa_consent` automatically)
- API keys all use `ak_live_` prefix now (legacy `hoa_live_` keys still authenticate)
- All provider revenue-split percentages are hidden from public surfaces; legal 65/35 disclosure lives only in `/terms`
- Premium model weight bumped from 5× to 10× in `src/lib/plans.ts` so Sonnet-class agents break even on Field Agent tier and stay positive on Double-0

## Session's commits (all on `main`)

```
0c74b8f chore: re-trigger Railway deploy after transient orchestrator failure
0163116 fix(pipeline): block random-agent routing, refund failed calls, honest provider earnings
8390657 chore(ux): redesign cookie banner to match AK aesthetic + final HOA_API_KEY cleanup
5d79add fix(qr): clarify mobile-scan use + desktop Telegram Web fallback
f26a903 docs: post-honesty-pass teardown
429037f docs(api): flag Idempotency + Webhook Signatures as COMING SOON
31ba292 fix(ux): show PENDING instead of 0.0 for un-benchmarked agents
ca86b48 fix(link): show BotQR on unsigned state so users can open bot first
bf44d64 chore: honesty pass — kill false claims, HoA legacy, and pricing opacity
```

Plus the current in-progress commit adding the logo mark to the NavPill + this CONTEXT.md doc.

## Key reference docs

- **`docs/PRE-LAUNCH-CHECKLIST.md`** — three items that need the user's hand: Stripe test-transfer verification, payout scheduler, test-harness removal. Step-by-step.
- `docs/superpowers/plans/2026-04-23-honesty-pass-cleanup.md` — original Plan 1 task list
- `docs/teardowns/2026-04-23-post-honesty-pass-teardown.md` — first teardown, generated after Plan 1 shipped
- `docs/teardowns/2026-04-23-pipeline-audit.md` — second teardown, generated after live end-to-end pipeline testing uncovered the four pipeline bugs fixed in commit `0163116`
- `docs/superpowers/specs/2026-04-13-cost-model-reference.md` — living cost model / pricing reference (now partly superseded by the credits model — updates pending)

---

## Pricing model — SHIPPED 2026-04-24

Credits-denominated subscriptions. Subscription dollars = credit dollars. One credit = $0.01.

**Burn rate by tier:** Haiku 1 cred / Standard 2 cred / Premium 10 cred.
(Corrected 2026-09-01 — this doc said 3; `src/lib/plans.ts` MODEL_TIER_WEIGHTS says 2. Code is authoritative.)

**Plans:**
| Plan | Price | Credits | Model access |
|---|---|---|---|
| Recruit | $0 | 100 | Haiku only |
| Field Agent | $19 | 1,900 | All |
| Double-0 | $79 | 7,900 | All |
| Shadow | $249 | 24,900 | All + priority |

**Authoritative payout input:** `ApiCall.creditsConsumed` column (snapshotted at call time from the agent that actually served the request, including fallback substitutions). `costCents` retained as legacy; not used for payout math. Historical rows backfilled to 1 credit (Haiku-equivalent) in migration `20260424003416_add_credits_consumed`.

**Anti-fraud on provider-declared tier:** `POST /api/agents` force-resets to Haiku regardless of declared tier. Provider gets a `tierPendingReview` flag in the response. Standard/Premium listing requires admin upgrade after signature verification. See `src/app/api/agents/route.ts:190-230`.

**Plan-tier gating:** Recruit (free) can only call agents with `modelTier: 'haiku'`. Paid tiers have `allowedModelTiers: null` for unrestricted access. Enforced in `src/lib/router.ts` on both the specific-slug and strategy-based routing paths. Returns HTTP 403 (not 404).

**Monthly credit reset:** Stripe webhook now handles `invoice.paid` / `invoice.payment_succeeded` to reset `callsBalance = callsLimit` + zero `callsUsed` on every successful renewal. The `subscription_create` invoice (initial checkout) is skipped since `checkout.session.completed` already handled it.

**Verified live against production** (sim at end of session 2026-04-24):
- Recruit subscriber burns 1 credit per Haiku call (100 → 99 → 98 → 97 after 3 calls)
- Premium calls seeded with `creditsPerCall: 10`, `totalCreditsConsumed: 6,000` for 600 calls
- `provider/stats` returns `pendingGrossCents: 6,000`, `pendingProviderShareCents: 3,900` — exactly 65%
- Below-minimum skip fires correctly ($39 share < $50 min), no audit row written (roll-forward intact)

---

## Plan 2 — Payments pipeline — SHIPPED 2026-04-23

### What shipped

- **`Payout` table** (`prisma/schema.prisma` + migration `20260423235006_add_payout_table`): `periodStart, periodEnd, grossCents, providerShareCents, callCount, status ("pending"|"paid"|"skipped"|"failed"), skipReason, failureReason, stripeTransferId (unique), paidAt`. Unique `(providerId, periodEnd)` prevents double-pay on same window; unique `stripeTransferId` prevents duplicate transfer attribution.
- **`src/lib/payouts.ts`** as the single source of truth for provider-earnings math. Exports `PROVIDER_SHARE = 0.65` and `MIN_PAYOUT_CENTS = 5000`, plus `aggregateProviderEarnings`, `runPayoutForProvider`, `runAllPayouts`, `getLastReconciledBoundary`. Boundary advances only on `paid` status — earnings below the $50 minimum or before a Stripe onboarding roll forward, they don't get forgotten.
- **`POST /api/admin/payouts`** (header `x-admin-secret: $BENCHMARK_CRON_SECRET`): `{"dryRun":true}` previews, no body runs for real. Returns full per-provider result array with `paid|skipped|failed` counts and reasons. Stripe Transfer sent with `idempotencyKey=payout_<id>` so retries never double-send.
- **`GET /api/admin/payouts`** same auth — last 50 rows with provider email, for debugging.
- **`GET /api/provider/payouts`** — provider-scoped Bearer-auth; returns their own 24 most-recent rows + `minPayoutCents`.
- **Provider dashboard** (`ProviderDashboardClient.tsx`): new PAYOUT HISTORY section between Stripe Connect and Agents List. Columns: period end, calls, gross, your share, status, transfer/skip ref.
- **`GET /api/provider/stats`** now separates `pending{Gross,ProviderShare}Cents` (since last paid boundary) from `lifetime{Gross,ProviderShare}Cents` — fixes the "earnings never decrease" UX bug. Legacy `totalRevenue` field now shows pending share only.
- **Test harness** (`POST /api/admin/test-harness`, same admin secret): disposable QA helper with `seed-calls`, `register-agent`, `attach-stripe`, `activate-agent`, `purge` actions. **REMOVE BEFORE PUBLIC LAUNCH.**

### What was verified end-to-end against production

Ran the simulation twice. Confirmed working:
- Subscriber + provider registration via public endpoints
- Synthetic agent registration + activation
- Seeding successful `ApiCall` rows, `provider/stats` showing exact `grossCents × 0.65` share
- `POST /api/admin/payouts` dry-run returns without side effects
- Real run skips providers below `$50` minimum (no row written — noise eliminated)
- Real run skips providers with no `stripeAccountId` (writes audit row)
- **Roll-forward confirmed**: 30 calls below min → skipped no row → +60 calls still below min → pending stats showed all 90 calls → +70 calls above min → payout aggregated all 160 calls with `grossCents: 8000, providerShareCents: 5200`
- Stripe `account.retrieve` failure writes a `failed` audit row with the real Stripe error message (after fix in commit `02f41ad`)
- Provider payout history endpoint returns correct rows for the provider scope
- `purge` cleans up QA users + their calls + their payouts

### What is NOT E2E-verified (requires user action)

**The `paid` path itself.** I couldn't fully test a successful Stripe Transfer because that needs a real Connected Account where `charges_enabled && payouts_enabled == true`. In test mode you can create one through Stripe's test-mode onboarding flow.

To finish verifying the paid path end-to-end:

1. Create a test Stripe Connected Account:
   ```
   Dashboard → Connect → Create test account → complete Express onboarding with Stripe test data
   ```
   Note the `acct_...` ID (test mode).

2. Attach it to a test provider via test-harness:
   ```bash
   curl -X POST https://acoustickitty.ai/api/admin/test-harness \
     -H "x-admin-secret: $BENCHMARK_CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"action":"attach-stripe","providerApiKey":"<their-ak_live_>","stripeAccountId":"acct_..."}'
   ```

3. Seed calls above $50 share threshold:
   ```bash
   # 200 calls @ 50¢ = $100 gross, $65 share — comfortably above $50
   curl -X POST https://acoustickitty.ai/api/admin/test-harness \
     -H "x-admin-secret: $BENCHMARK_CRON_SECRET" \
     -H "Content-Type: application/json" \
     -d '{"action":"seed-calls","providerApiKey":"<their-ak_live_>","count":200,"costCents":50}'
   ```

4. Run payouts:
   ```bash
   curl -X POST https://acoustickitty.ai/api/admin/payouts \
     -H "x-admin-secret: $BENCHMARK_CRON_SECRET"
   ```

5. Expected outcome: Payout row created with `status=paid`, `stripeTransferId=tr_...`, `paidAt` set. Provider's Stripe test balance shows the $65 transfer in their test dashboard.

### Open items on Plan 2

- **Schedule the runner.** Currently invoked manually. Plausible options: a Railway cron (simplest), a GitHub Actions cron that POSTs to `/api/admin/payouts` on the first of each month, or leave it manual and commit to doing the run on the first business day of each month.
- **Email provider on successful payout.** Nice-to-have; not built.
- **Remove test-harness endpoint before public launch.** File: `src/app/api/admin/test-harness/route.ts`. Can mint arbitrary earnings if admin secret leaks.
- **Provider dashboard empty-state copy** on payouts history could be richer ("Your first payout will process on the first of the month once you cross $50") — minor polish.

---

## Plan 3 — Benchmarking v1 (NEXT RECOMMENDED)

Still the thesis-validation work. Spec unchanged from the first teardown:
- Hybrid scoring: `0.6 × battery_score + 0.3 × live_sample_score + 0.1 × user_rating`
- Battery: 10 tasks per category, kept secret, 2-3 rotated monthly, Opus 4.6 judge with published category-specific rubric
- Live sample: 1% of real calls sampled by Haiku, flagged ones escalated to Opus
- User ratings: opt-in, 1-5 stars, weighted by recency
- New agents: 100% battery for the first 2 weeks, then blend in live data
- Public methodology page at `/how-we-benchmark` (this already has a stub link in the footer pointing at `/`)

Estimated effort: 4-6 hours.

Needs user decisions before starting:
- [ ] Category count committed at launch (current: 3 effective / 7 agents)
- [ ] House agents or external-only (recommend seed 3-5 in empty categories — code-review, document-analysis)
- [ ] Minimum score threshold for listing (recommend 5.0 soft, 3.5 hard)

---

## Plan 4 — Routing quality (category still too coarse)

**The underlying problem:** today's fix prevents random dispatch across categories, but within a category the router still picks by `currentScore DESC` with NULL tiebreak = insertion order. A "research" task routes to Bible Study first, because Bible Study was seeded first. Bible Study then politely refuses, which is actually correct agent behaviour but wasted the user's call.

**Two viable fixes:**

1. **Intent classifier before routing.** The Telegram gateway at `src/lib/messaging/gateway.ts` already uses Haiku to classify intent into the right agent. Lift that same logic into `/api/v1/run` when the user only provides `category`. Adds ~$0.0004/call platform cost.

2. **Skill/tag matching.** Each agent has a `tags: String[]` field (already in schema). Require agents to declare specific skill tags on registration. When routing, intersect task keywords with agent tags. No LLM call, but requires provider education.

Recommend (1) for launch and (2) as a follow-up. Estimated effort: 2-3 hrs for (1).

---

## Plan 5 — Registration security

Both `POST /api/subscribers/register` and `POST /api/providers/register` are fully open. No rate limit, no captcha, no email verification. Anyone can create unlimited API keys.

**Scope:**
- IP-based rate limit (10 registrations per IP per day) using Redis — reuse `src/lib/rate-limit.ts` pattern
- Turnstile or hCaptcha on the web signup form
- Email verification gate: generate keys immediately but mark `onboardingComplete: false`; don't allow API calls until a verification link is clicked
- The existing `onboardingComplete` column on `User` is not currently used for gating — wire it up

Estimated effort: 1-2 hrs.

---

## Open decisions

Carried forward from prior teardowns. User to answer as each becomes relevant:

| # | Question | Notes |
|---|----------|-------|
| 1 | Bot migration window | Still default "hard cutover" since user never explicitly chose. Old `@houseofagents_bot` hasn't been notifying users to switch. If relevant, build a DM-all-linked-users notifier. |
| 2 | Private beta or public launch | Affects whether to add a "Request access" gate |
| 3 | Category count committed at launch | Currently 3 effective / 7 agents. Recommend 5-7. |
| 4 | House agents or external-only recruitment | Recommend seeding 3-5 house agents in empty categories |
| 5 | Benchmark threshold | Recommend 5.0 soft / 3.5 hard |
| 6 | Should providers and subscribers share the same `User`/`apiKey` (dogfooding) or have separate identities | Current: shared, with `role` field. Works today but provider dashboard doesn't show their consumer-side balance. |

---

## Known issues NOT fixed — audit trail

From `docs/teardowns/2026-04-23-pipeline-audit.md`. Prioritized as best-judgement blockers first.

1. ~~**No automated payout pipeline**~~ — SHIPPED 2026-04-23 (Plan 2). Still needs a scheduled trigger + removing the test-harness before public launch.
2. **No automated benchmarking** — Plan 3. Blocks the product thesis.
3. **Open registration endpoints** — Plan 5. Low urgency until someone spams.
4. **Coarse within-category routing** — Plan 4. Embarrassing user-facing issue.
5. **`costCents` semantics** — per-call "list price". `provider/stats` and the payouts runner both multiply by 0.65 for provider share. Long-term either (a) pool-distribution math at payout time, or (b) true per-call billing with auto-upgrade thresholds.
6. **Provider account consumer-side balance hidden** — if a provider makes test calls against other agents, they decrement their own `callsBalance` but the provider dashboard only shows provider stats. They won't know they're out of balance until they get a 429.
7. **Idempotency contract documented but not enforced.** Doc says `Idempotency-Key` is respected on POST /api/v1/run; code does nothing with the header. The `/reference#idempotency` section has a "COMING SOON" banner.
8. **Webhook signature contract documented but not signed.** Outgoing callback POSTs from `/api/v1/run/route.ts:161` send no `X-AcousticKitty-Signature`. `/reference#webhook-signatures` has a "COMING SOON" banner.
9. **`/api/agents` vs `/api/v1/run` version inconsistency.** Versioned + unversioned routes live side by side. Either add a `/api/v1/agents` alias or document the split honestly.
10. **Test harness must be removed before public launch.** `src/app/api/admin/test-harness/route.ts` is admin-secret-gated but can mint synthetic earnings.

---

## Telegram bot state

- Handle: `@AcoustickittyBot` (user registered via BotFather, confirmed done)
- Token: in Railway as `TELEGRAM_BOT_TOKEN`
- Webhook: user registered manually via `setWebhook` curl
- BotFather config complete per user: name, description, about text, commands (`/start`, `/agents`, `/link`, `/usage`, `/help`), privacy mode enabled, privacy policy URL set to `https://acoustickitty.ai/privacy`
- User will add the logo as bot profile picture via BotFather `/setuserpic`
- Migration plan (from old `@houseofagents_bot`) was never built — if there are existing linked users, they'll discover the new bot organically. If the user wants a proactive notifier, open Plan item.

---

## Branding assets

- **Primary logo:** `/public/acoustickitty-logo.png` (512×512 PNG, black on white background) — just added this session
- **First placement:** floating NavPill on the landing page (bottom-centre) — replaces the old "◆ AK" text mark with a small white rounded square containing the logo
- **Other placements to consider (not this session):**
  - Favicon (currently still the old `src/app/favicon.ico` — Next.js App Router supports `src/app/icon.png` for auto-generation, worth replacing)
  - Header wordmark alongside "Acoustic Kitty." text (subtle 18-20px mark before the italic)
  - Open Graph social previews (currently uses a text-only OG card at `src/app/api/og/[slug]/route.tsx`)
  - Provider dashboard empty states, onboarding screens

User's direction: **add the logo subtly**, don't go loud. Minor branding tweaks (colour balance, spacing) are on the user's backlog.

---

## How to pick up next session

1. Open this file (`docs/CONTEXT.md`)
2. Check `git log --oneline -20` for anything pushed since this doc was last updated
3. Read `docs/teardowns/2026-04-23-pipeline-audit.md` for the pipeline state
4. Confirm with user which plan to execute next — default recommendation is Plan 2 (payouts)
5. When starting a plan, create a new plan doc under `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md` with the writing-plans skill

## How to talk to the pipeline manually

```bash
# Create a throwaway test subscriber (public endpoint — this works today)
TS=$(date +%s)
curl -sS -X POST https://acoustickitty.ai/api/subscribers/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"qa-${TS}@acoustickitty.ai\",\"name\":\"QA ${TS}\",\"plan\":\"recruit\"}" \
  | tee /tmp/sub.json
AK_KEY=$(cat /tmp/sub.json | python3 -c 'import sys,json; print(json.load(sys.stdin).get("apiKey",""))')

# Make a real call (will 400 without category, 200 with)
curl -sS -X POST https://acoustickitty.ai/api/v1/run \
  -H "Authorization: Bearer $AK_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task":"...","category":"research","routing":"performance"}'

# Create a throwaway provider
curl -sS -X POST https://acoustickitty.ai/api/providers/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"qa-prov-${TS}@acoustickitty.ai\",\"name\":\"QA Prov ${TS}\"}"

# Dashboard views
curl -sS https://acoustickitty.ai/api/dashboard/stats -H "Authorization: Bearer $AK_KEY"
curl -sS https://acoustickitty.ai/api/provider/stats -H "Authorization: Bearer $PROV_KEY"

# Health
curl -sS https://acoustickitty.ai/api/v1/health
```

Note: open-registration is a known vulnerability but also essential for manual QA until Plan 5 is built. Once Plan 5 ships, the above flow will need the captcha/verification workaround.
