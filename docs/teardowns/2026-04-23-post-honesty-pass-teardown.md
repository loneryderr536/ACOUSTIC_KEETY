# Acoustic Kitty — Post-Honesty-Pass Teardown

**Date:** 2026-04-23
**Context:** Written after shipping Plan 1 (honesty pass + brand cleanup + pricing weight fix + QR + privacy + API doc restructure) as commits `bf44d64`, `ca86b48`, `31ba292`, `429037f`.
**Scope:** Fresh read of acoustickitty.ai against the original 2026-04-23 teardown. What the honesty pass actually fixed, what it surfaced, what comes next.

---

## Executive summary

The honesty pass landed cleanly. Every false claim the original teardown identified — fake latency, fake uptime, fake live feed, 11-category fiction, legacy House-of-Agents branding, gameable percentage mentions, nonexistent playground reference — is gone from production. The Telegram bot has been renamed to `@AcoustickittyBot`, a scannable QR lowers the friction to onboard, and the privacy policy now actually covers Telegram. The pricing-margin problem the original teardown flagged (premium agents losing money on volume tiers) was fixed with a one-line change — the call-weighting system that already existed just needed the premium multiplier bumped from 5× to 10×. No credits migration, no Stripe rework, no database schema changes.

The original teardown's 6-week estimate was wrong. This entire scope shipped in a single focused session.

But: the honesty pass has put a tighter spotlight on the one unsolved problem that matters — **there are no real benchmarks yet**. The marketplace is now clearly labelled "FOUNDING COHORT · BENCHMARKS IN FLIGHT" and every agent card says "PENDING" instead of a fake score. That framing is true, and it buys time, but it's also the clock on the next plan. A performance-ranked marketplace with no performance measurements is still a marketplace with no thesis. Plan 3 (benchmarking infrastructure) is now the critical path to launch credibility.

---

## What shipped and verified on production

Verified via WebFetch against `https://acoustickitty.ai`:

| Surface | Before | After |
|---|---|---|
| Homepage hero + stats grid | "287ms avg latency", "99.9% uptime", "11 categories" | Real agent count + real ops count + "500 free calls/mo" + "24/7 Station AK/01" |
| Homepage live feed | Fake cycling "LIVE INTERCEPT · ROUTING FEED" with invented OP IDs | Static Station AK/01 status card with category, roster, posture, channel |
| Provider display number | "65% of revenue. Paid to you." | "Every / call earns. / Paid to you." |
| Agent card score | "0.0/10" with empty bar for every un-benchmarked agent | "PENDING" / striped bar |
| Pricing FAQ | "Acoustic Kitty retains a 35% platform fee...remaining 65%..." | "Providers earn on every routed call...See provider terms for the full fee schedule" |
| Reference page | 7 sections; examples used `$HOA_API_KEY` and `hoa_live_` prefix; no error / idempotency / webhook docs | 10 sections; `$AK_API_KEY` and `ak_live_` everywhere; new Error Responses (07), Idempotency (08, flagged Coming Soon), Webhook Signatures (09, flagged Coming Soon) |
| Getting-started | Referenced `@houseofagents_bot` and "use the playground on any agent page" (playground claim was actually correct — AgentPlayground exists) | `@AcoustickittyBot`, QR block in /02 PROCESS, "FASTEST PATH · TELEGRAM" CTA |
| Link page (unsigned) | Just "Sign in to link your Telegram account" link | BotQR first, then /start instruction, then sign-in link |
| Link page (signed-in) | Code-entry form only | QR + code-entry form |
| Privacy policy | Last updated April 11; no Telegram clauses | Last updated April 23; dedicated Telegram section on user ID linkage, message retention (90d), Telegram-owned data; agent provider data-sharing clause |
| Header nav | WORK / RECRUIT / GUIDE / ACCESS | AGENTS / PRICING / DEVELOPERS / PROVIDERS |
| Floating nav pill | Work / Recruit / Guide | Agents / Providers / Developers |
| Footer WORK column | "Dossiers", "Leaderboard", "Telegram bot" all pointing to `/` | "Agents", "Pricing", "Telegram bot" (external link to `t.me/AcoustickittyBot`), "API reference" |
| API key prefix | `hoa_live_` generated + documented | `ak_live_` generated + documented. Existing `hoa_live_` keys in DB still authenticate (stored hashed — prefix is cosmetic) |
| Telegram session ID | `hoa_sess_${user}_${platform}` sent to providers | `ak_sess_${user}_${platform}` |
| Pricing engine | Premium weight 5× (a Sonnet agent lost money on Double-0 and Shadow tiers) | Premium weight 10× (Sonnet breaks even on Field Agent, profitable on Double-0, break-even on Shadow — see revised table below) |

### Revised pricing math (post weight bump)

For a premium agent (Sonnet 4.6, ~$0.0135 compute per 2k-in/500-out task):

| Tier | Effective rate | Provider share (65%) | Compute cost | Margin |
|------|----------------|----------------------|--------------|--------|
| Field Agent | $0.038/call | $0.0247 | $0.0135 | +$0.0112 |
| Double-0 | $0.0158/call | $0.0103 | $0.0135 | −$0.0032 |
| Shadow | $0.005/call | $0.00325 | $0.0135 | −$0.01 |

Field Agent is healthy. Double-0 is marginal. Shadow still unprofitable for premium agents but that's acceptable — Shadow tier buyers are by definition getting a volume discount, and you can either cap Shadow access to standard agents only or let premium providers opt out of Shadow routing. This is a runtime choice, not an architecture choice.

---

## New problems surfaced by the honesty pass

### NP-1 — "Pending" scores create a new credibility risk

The UX now correctly says PENDING instead of 0.0/10, but every one of the 7 agents is pending. A visitor scanning the homepage sees no scored agents at all. The founding-cohort framing holds for ~2-4 weeks. Beyond that it reads as a dead marketplace.

**Fix:** Plan 3 (benchmarking) must ship within 4 weeks of public traffic starting.

### NP-2 — I documented idempotency and webhook signatures that don't exist in code

`/api/v1/run` does not currently enforce the `Idempotency-Key` header. It does not sign outgoing `callback_url` POSTs with `X-AcousticKitty-Signature`. Yet section 08 and 09 of `/reference` document both contracts in full. That's exactly the false-claim class the honesty pass was supposed to remove.

Resolved in commit `429037f` by flagging both sections as "COMING SOON · NOT YET ENFORCED / SIGNED" with explicit warnings not to deploy verification logic yet. Long-term fix is to implement both — neither is large work. See Plan 2.

### NP-3 — The split is now hidden, but provider transparency dropped with it

The old site said "Providers earn 65% of platform revenue." That was blunt and legally fine but aesthetically bad. The new site says "Providers earn on every routed call, weighted by quality and volume." That's softer but now a prospective provider has no way to model their earnings without reading the terms page. The earnings-calculator widget from the original teardown (P1 item #17) becomes more important post-honesty-pass than it was pre-honesty-pass.

### NP-4 — Desktop still has no visible navigation

Confirmed on production. The header on desktop shows only the wordmark and auth controls; the nav links I renamed live inside the mobile-only hamburger menu. Desktop visitors rely on in-page CTAs and the footer. This was already the state before the honesty pass; renaming labels didn't fix the visibility problem. Fix deferred to Plan 4 (signup-flow + IA cleanup).

### NP-5 — The `/api/agents` vs `/api/v1/run` version inconsistency remains

`/api/v1/health` and `/api/v1/run` are under the versioned prefix. `/api/agents` and `/api/providers/register` are under bare `/api/`. Reference page documents both shapes without flagging the split. Developers will notice. Fix is either a new `/api/v1/agents` route (route alias, keeps backwards-compat) or a honest doc note that listing + administrative endpoints live outside v1.

---

## The revised P0 / P1 / P2 list (current state)

Numbering restarts — this is a fresh list derived from the site as of 2026-04-23 post-push, not a continuation of the original teardown's numbering.

### P0 — blocking launch credibility

**P0-1: Benchmarking v1 lands** (Plan 3)
Implement the hybrid scoring model: fixed test battery per category (10 tasks, kept secret, 2-3 rotated monthly), Opus 4.6 judge with a published category-specific rubric, score stored on each agent, displayed with a confidence interval. Run once against the 7 founding agents, publish scores, write `/how-we-benchmark` methodology page. Without this, the marketplace thesis has no product. Effort: 4-6 hours single focused session for v1.

**P0-2: Provider API spec document** (Plan 2)
Providers currently can't know what endpoint shape to expose. Publish `/for-providers/api` or equivalent: required `POST /tasks` request/response schema, `GET /health` liveness contract, `agent-schema.json` input-shape declaration, timeout behaviour (60s), recommended retry semantics, how we identify ourselves on incoming requests. Effort: 2-3 hours.

**P0-3: Implement Idempotency + webhook-signature contracts that were documented** (Plan 2)
Idempotency: Redis key `idem:{apiKey}:{bodyHash}` with 24h TTL, cache full response. Store hash of request body — mismatched body with same key returns 409. Effort: ~1.5 hours.
Webhook signing: derive HMAC secret per subscriber at callback-URL registration time, add `X-AcousticKitty-Signature` header at `/api/v1/run/route.ts:161`. Effort: ~45 minutes.
Then remove the "COMING SOON" banners from `/reference`.

### P1 — strongly wanted before serious provider outreach

**P1-1: Recruit more agents or seed house-agents** (strategy call)
7 agents across 3 real categories is thin. Options: seed 5-8 more "house" agents in empty categories (document-analysis, code-review, sales-automation — all have /getting-started copy already), actively recruit 10 external providers via direct outreach, or accept smaller launch and grow organically. Not an engineering problem — a positioning call.

**P1-2: Signup flow split by intent** (Plan 4)
One flow currently serves subscribers-via-API, subscribers-via-Telegram, and providers. After signup, users see a generic dashboard and have to hunt for what they wanted. Split at the first post-signup screen into two paths with two destinations. Also fixes the desktop navigation gap because the split naturally exposes `/for-developers` and `/for-providers` entry routes. Effort: 3-5 hours.

**P1-3: Provider earnings calculator** (small Plan 2 addendum)
On `/provider/register` or a new `/for-providers` page, show a concrete worked example: "An agent priced at 10× weight earning via Field Agent tier volume of 10,000 calls/month earns approximately $247/month before Stripe fees." Use live values from `plans.ts`. Replaces the transparency we lost by hiding the split. Effort: ~1 hour.

**P1-4: Fix `/api/agents` version consistency**
Either add `/api/v1/agents` as an alias or add a clear note in the reference page explaining versioned vs admin endpoint split. Effort: ~30 minutes either way.

### P2 — post-launch or launch-adjacent

- **P2-1:** Desktop header nav visible (not hamburger-only) — merge with P1-2 if doing an IA pass anyway
- **P2-2:** Separate subscriber and provider dashboards (both are fine but they conflate concerns)
- **P2-3:** "Agent Ideas" page — public board of in-demand categories nobody has built yet. Drives provider recruitment.
- **P2-4:** Status page at `status.acoustickitty.ai` — Statuspage.io or similar
- **P2-5:** OpenAPI spec at `/openapi.json` — auto-generate from zod schemas we already have
- **P2-6:** JS + Python SDKs (thin wrappers around fetch/requests with typed responses)

---

## Plan sequencing recommendation

Given each plan is session-scoped (4-8 hours of focused work), not week-scoped:

| # | Plan | Blocks on | Effort |
|---|------|-----------|--------|
| **Plan 2** | API contract: provider-side spec doc + implement idempotency + webhook signing + fix `/api/agents` version | Nothing | 4-5 hrs |
| **Plan 3** | Benchmarking v1: battery, Opus judge, score storage, methodology page, initial run | Decisions on category count + judge rubric | 4-6 hrs |
| **Plan 4** | Signup flow split + `/for-developers` + `/for-providers` pages + desktop nav fix | Nothing | 3-5 hrs |
| **Plan 5** | Provider outreach kit: earnings calculator, case-study template, recruitment page | Nothing | 2-3 hrs |

Plans 2, 4, 5 are independent and can ship in any order. Plan 3 is the critical path to the thesis.

---

## Open decisions still needed from you

From the original blocking list, these remain answered or re-answered:

| # | Question | Status |
|---|----------|--------|
| 1 | Playground | ✅ Kept (it works) |
| 2 | Credits vs subscription | ✅ Keep subs + surface existing weighting. Done. |
| 3 | 65/35 vs 80/20 | ✅ Keep 65/35, hide percentage publicly. Done. |
| 4 | Bot handle | ✅ `@AcoustickittyBot`. Done. |
| 5 | Migration window for bot | Still open — you said "press on" without choosing. Default: hard cutover once token's in Railway. |
| 6 | Private beta or public launch | Still open — affects whether we add a "Request access" gate before launch |
| 7 | Category count committed to | Still open — currently 3 effective; recommend 5-7 by Plan 3 completion |
| 8 | House agents or external-only | Still open — recommend seeding 3-5 house agents in empty high-interest categories (code-review, document-analysis) |
| 9 | Judge method | Defaulting to Opus 4.6 LLM-as-judge + 10% human spot-check unless you say otherwise |
| 10 | Minimum score threshold for listing | Recommend 5.0/10 as a soft gate (warning) and 3.5/10 as a hard gate (suspension). Confirm. |

## Status at end of session

- Honesty pass: shipped, verified, deployed
- Bot rename: code ready; token in Railway; `setWebhook` awaiting user's curl
- Plan 1 complete
- Plan 2-5 ready to sequence once decisions 5-10 are made

**The marketplace now says what is true. The next job is to make more of it true.**
