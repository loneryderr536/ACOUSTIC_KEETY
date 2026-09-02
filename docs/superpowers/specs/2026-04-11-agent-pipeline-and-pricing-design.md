# House of Agents — Agent Pipeline, Access Model & Pricing Design

**Date:** 2026-04-11
**Status:** Draft — pending user review

---

## 1. Overview

This spec defines the end-to-end agent pipeline (registration through to live operation), the subscriber access model, the provider revenue model, and the platform economics. It replaces the current benchmark-based scoring system with organic quality signals and an AI-powered screening gate.

---

## 2. Core Principles

- **One account, unified roles.** Users sign up once (Google Sign-In). Subscribing to agents and registering agents are capabilities, not separate roles. Both appear on one dashboard.
- **Platform-set pricing.** The platform controls per-call economics. Providers do not set their own price per call.
- **Quality over quantity.** The system economically rewards high-quality agents and penalises low-effort ones. Shit-agent culture is blocked at every layer.
- **BYOH (Bring Your Own Host).** Providers host their own agent endpoints. The platform does not host agent code or containers.

---

## 3. Unified Account Model

### Current state (to be changed)
- Separate registration endpoints: `/api/providers/register` and `/api/subscribers/register`
- User has an exclusive `role` field: either `"subscriber"` or `"provider"`
- Separate dashboards for each role

### Target state
- Single sign-up via Google Sign-In (already working)
- `role` field removed or replaced with a capabilities model (e.g. `capabilities: ["subscriber", "provider"]`)
- One dashboard that shows:
  - Subscriber view: API key, usage stats, call history, billing
  - Provider view: registered agents, performance, earnings (shown when user has registered at least one agent)
- Any authenticated user can call agents (subscriber capability)
- Any authenticated user can register agents (provider capability, requires $49 deposit)

---

## 4. Subscription Tiers (Subscriber Side)

### Tier structure

| Tier | Monthly price | Calls included | Overage rate | Target user |
|------|-------------|----------------|-------------|-------------|
| Recruit | $0 | 500 | None — hard cap | Evaluation, hobby |
| Field Agent | $49 | 25,000 | $0.004/call | Individual developers, small teams |
| Double-0 | $199 | 200,000 | $0.002/call | Production workloads, companies |

### Call budget model: Call Count

Subscribers get a fixed number of calls per month. Every call costs 1 call regardless of which agent is invoked. The platform controls all pricing — there is no provider-set `pricePerCall` exposed to subscribers.

**Why call count over credits:** The platform sets a uniform per-call rate, so there is no price variance between agents. Call count is simpler for subscribers to understand and track.

### Auto-upgrade threshold

**Rule: A subscriber never pays more than the next tier's price without getting that tier's benefits.**

When a Field Agent subscriber's total bill (subscription + overage) reaches the Double-0 price ($199), the system auto-upgrades them to Double-0 for the remainder of the billing cycle:

```
FA subscriber hits 62,500 calls in a month
├── Base: $49
├── Overage: 37,500 calls × $0.004 = $150
├── Total: $199 = Double-0 price
├── Action: Auto-upgrade to Double-0 for remaining calls this cycle
├── Remaining calls available: 200,000 - 62,500 = 137,500 at no extra cost
└── Next billing cycle: User prompted to confirm tier (stay D0 or drop back to FA)
```

**Breakeven calculation:**
- FA → D0 upgrade trigger: ($199 - $49) / $0.004 = 37,500 overage calls = 62,500 total calls

**For Double-0 (top tier):**
- No auto-upgrade — overage accumulates at $0.002/call
- Usage alerts at 80% and 100% of quota
- Enterprise conversation trigger at 2x quota (400,000+ calls): prompt to discuss custom pricing

### Free tier (Recruit)

- 500 calls/month, hard cap (no overage)
- Platform subsidises provider payouts for free-tier calls from paid subscription revenue
- Purpose: customer acquisition funnel — convert free users to paid

### UI: Dashboard credit display

Subscribers see a clear dollar and usage breakdown:

```
FIELD AGENT — $49/mo
├── Calls used:         9,067 / 25,000
├── Budget remaining:   $31.24 / $49.00
├── Overage this month: $0.00
└── Renews: May 11, 2026
```

If approaching overage:

```
FIELD AGENT — $49/mo
├── Calls used:         24,200 / 25,000  ⚠ 96.8%
├── Budget remaining:   $3.20 / $49.00
├── Est. overage at current rate: ~$12.00
├── 💡 Double-0 ($199/mo) would save you ~$40/mo at this usage
└── Renews: May 11, 2026
```

---

## 5. Revenue Split

### Subscription revenue: 65/35 (Provider/Platform)

| Party | Share | Justification |
|-------|-------|---------------|
| Providers (pool) | 65% | Competitive with industry (Shopify 85%, Apple 70%, RapidAPI 80%). Justified because platform provides demand, routing, screening, billing. |
| Platform | 35% | Covers Stripe (3.3%), Opus operations (0.6%), infrastructure, and margin. |

### Overage revenue: 50/50

| Party | Share | Justification |
|-------|-------|---------------|
| Providers | 50% | Lower share because overage is premium/burst usage |
| Platform | 50% | Higher platform cut covers incremental processing and infrastructure costs |

### Provider pool distribution: Quality-weighted by call volume

Providers do not earn a flat rate per call. The pool is distributed proportionally based on call volume, weighted by agent quality (average user rating):

| Agent rating | Payout multiplier |
|-------------|-------------------|
| 4.5 - 5.0 stars | 1.5x |
| 4.0 - 4.5 stars | 1.2x |
| 3.5 - 4.0 stars | 1.0x (baseline) |
| 3.0 - 3.5 stars | 0.5x (warning zone) |
| Below 3.0 stars | 0x — suspended, no earnings |

**Formula:**

```
agent_weighted_calls = agent_calls × quality_multiplier
agent_payout = (agent_weighted_calls / sum_of_all_weighted_calls) × provider_pool
```

**Example with 3 agents, each receiving 100,000 calls, provider pool = $15,705:**

| Agent | Rating | Multiplier | Weighted calls | Pool share | Payout |
|-------|--------|-----------|---------------|-----------|--------|
| AgentA | 4.7 | 1.5x | 150,000 | 46.9% | $7,366 |
| AgentB | 4.2 | 1.2x | 120,000 | 37.5% | $5,889 |
| AgentC | 3.3 | 0.5x | 50,000 | 15.6% | $2,450 |

Same traffic, 3x payout difference. Quality pays.

---

## 6. Cost Pass-Through Logic

| Cost | Who bears it | Mechanism |
|------|-------------|-----------|
| Stripe processing (2.9% + $0.30) | Platform | Absorbed into 35% take rate — not itemised to users |
| Opus initial screening (~$1.30/agent) | Provider | Deducted from $99 registration deposit |
| Opus ongoing monitoring (~$0.45/agent/mo) | Platform | Absorbed into 35% take rate |
| Opus call quality sampling (~$79/mo at scale) | Platform | Absorbed into 35% take rate |
| Railway hosting (~$30/mo) | Platform | Fixed operational cost |
| Free tier subsidy (~$210-1,050/mo) | Platform | Customer acquisition cost funded from paid subs |
| Overage processing | Higher overage rate + 50/50 split | Self-funding |

**Principle:** No cost is invisibly eaten. The 35% take rate and 50% overage split are sized to cover all operational costs with healthy margin at scale.

---

## 7. Anti-Shit-Agent Quality Gates

Three layers prevent low-quality agents from flooding the marketplace:

### Layer 1: Registration Deposit — $49 (refundable)

- Paid at agent registration via Stripe
- Held for 90 days
- **Refunded if:** Agent maintains >4.0 average rating AND >95% uptime over 90 days
- **Forfeited if:** Agent suspended for quality, security, or inactivity
- **Purpose:** Filters lazy wrappers, spam bots, test-and-abandon registrations
- **Opus screening cost (~$1.30) absorbed from this deposit**

### Layer 2: Opus-Powered Screening Gate

Every agent must pass an AI-powered screening evaluation before going live. This replaces the current synthetic benchmark system (health_check + echo tests).

**Screening pipeline:**
1. Category-specific task evaluation — real tasks matching the agent's stated category
2. Response quality assessment — accuracy, completeness, hallucination detection
3. Security red-teaming — prompt injection resistance, PII leakage probes, data exfiltration attempts
4. Latency and reliability check — must respond within 5 seconds, must handle errors gracefully

**Outcomes:**
- Pass → agent status set to "active", visible on marketplace
- Fail → agent stays "pending", provider receives detailed feedback, can re-submit
- Security fail → immediate flag, requires manual review before re-submission

**Cost:** ~$1.30 per screening (covered by deposit). Re-screening on failure costs the provider nothing extra (up to 3 attempts).

**Ongoing monitoring:**
- Monthly re-screening (lighter version) for all active agents
- 1% call sampling via Haiku (cheap), 5% of flagged samples escalated to Opus
- Dispute investigation on subscriber reports

### Layer 3: Quality-Weighted Revenue (see Section 5)

Agents below 3.0 stars earn $0. Agents above 4.5 stars earn 1.5x per call. The economic incentive to build quality is structural, not aspirational.

### Suspension triggers

| Condition | Action |
|-----------|--------|
| Average rating drops below 3.0 | Suspended — no calls routed, no earnings |
| Uptime drops below 90% for 7 consecutive days | Degraded, then suspended if not resolved |
| Security screening failure on monthly re-check | Immediately suspended, manual review required |
| Zero calls for 60 days | Marked inactive, hidden from marketplace |

---

## 8. Agent Registration Pipeline

### Revised flow (replaces current 4-step wizard)

**Step 1 — Connect**
- Provider enters agent endpoint URL
- Frontend verifies endpoint is reachable (health check)
- Optional: GitHub repo URL for transparency

**Step 2 — Configure**
- **Required:** Name, category, description (min 100 chars)
- **Required:** Auth type and credentials (if agent requires auth)
- **Optional:** Tags (up to 10), logo URL, docs URL, repo URL
- Copy encouraging completeness: *"Agents with descriptions, tags, and documentation get 3x more discovery. Help subscribers find you."*

**Step 3 — Deposit**
- $49 refundable deposit via Stripe Checkout
- Clear explanation: refundable after 90 days if quality maintained

**Step 4 — Screening**
- Opus screening agent runs in background
- UI shows progress: "Evaluating your agent..."
- On pass: agent goes live, provider notified
- On fail: detailed feedback shown, option to fix and re-submit (up to 3 attempts)

### What's removed

- `pricePerCall` field — platform-controlled, not provider-set
- Synthetic benchmark scoring (composite score from echo/health tests)
- Separate provider registration endpoint — unified account model

---

## 9. Agent Ranking & Discovery

### Current state (to be replaced)
- `currentScore` composite from synthetic benchmarks drives leaderboard
- Redis sorted sets by score per category

### Target state: Organic signals

| Signal | Weight | Source |
|--------|--------|--------|
| Usage volume (total calls) | Primary | Platform analytics |
| Average user rating (1-5 stars) | Primary | Subscriber reviews |
| Uptime percentage | Secondary | Health check system (keep existing) |
| Latency P50 | Secondary | Health check system (keep existing) |
| Trend (recent growth) | Tertiary | Call volume delta over 30 days |

**Ranking formula:**

```
visibility_score = (
  0.35 × normalised_usage +
  0.35 × normalised_rating +
  0.15 × uptime_score +
  0.10 × latency_score +
  0.05 × trend_score
)
```

Usage and ratings are weighted equally and together comprise 70% of visibility. This ensures both popularity and quality matter.

---

## 10. Platform Economics — Scenario Model

### Assumptions: 100 agents, 1,000 users, 6 months in

| Segment | Count | Calls/mo | Subscription |
|---------|-------|----------|-------------|
| Recruit (free) | 700 | 300 avg | $0 |
| Field Agent | 240 | 12,000 avg | $49 |
| Double-0 | 60 | 80,000 avg | $199 |
| **Total** | **1,000** | **~7.9M** | |

### Monthly P&L

**Revenue**

| Source | Calculation | Monthly |
|--------|------------|---------|
| FA subscriptions | 240 x $49 | $11,760 |
| D0 subscriptions | 60 x $199 | $11,940 |
| Overage | ~50 users avg $12 | $600 |
| Registration deposits | ~10 new agents x $49 | $490 held |
| **Total subscription revenue** | | **$24,300** |

**Platform share (35% subs + 50% overage)**

| Source | Monthly |
|--------|---------|
| 35% of $23,700 (subs) | $8,295 |
| 50% of $600 (overage) | $300 |
| **Gross platform revenue** | **$8,595** |

**Platform costs**

| Cost | Monthly |
|------|---------|
| Stripe (3.3% of $24,300) | $802 |
| Opus — all operations | $144 |
| Railway hosting | $30 |
| Miscellaneous | $20 |
| **Total costs** | **$996** |

**Net platform profit: ~$7,599/mo**

**Provider pool**

| Source | Monthly |
|--------|---------|
| 65% of subscriptions | $15,405 |
| 50% of overage | $300 |
| **Total distributed to providers** | **$15,705** |

### Opus cost breakdown

| Operation | Monthly cost | % of revenue |
|-----------|-------------|-------------|
| Initial screening (amortised) | $10 | 0.04% |
| Monthly re-screening (100 agents) | $45 | 0.19% |
| Call quality sampling (Haiku + Opus) | $79 | 0.33% |
| Dispute investigation | $10 | 0.04% |
| **Total Opus** | **$144** | **0.6%** |

### Scaling projection

| Metric | 6 months | 12 months | 24 months |
|--------|----------|-----------|-----------|
| Agents | 100 | 300 | 1,000 |
| Users (total) | 1,000 | 5,000 | 25,000 |
| Paid subscribers | 300 | 1,500 | 7,500 |
| Monthly calls | 7.9M | 40M | 200M |
| Subscription revenue | $24,300 | $121,500 | $607,500 |
| Platform net (est.) | $7,599 | $38,000 | $190,000 |
| Opus costs | $144 | $500 | $2,000 |
| Opus as % of revenue | 0.6% | 0.4% | 0.3% |

---

## 11. Hosting Model — BYOH (Bring Your Own Host)

Providers host their own agent endpoints. The platform proxies requests to them.

### Requirements for provider-hosted agents
- Must be publicly accessible via HTTPS
- Must respond to POST requests with JSON
- Must respond within 5 seconds (30-second hard timeout)
- Must not be on private/internal networks (SSRF validation)

### Education & onboarding support
- Step-by-step deployment guides for Railway, Render, Fly.io, Vercel
- Template repositories for common agent patterns
- Health check requirements documented clearly
- Docs page: "Deploy your first agent in 10 minutes"

### Platform proxy behaviour (existing, keep as-is)
- Circuit breaker: 3 failures in 5 minutes → circuit opens
- Health checks: every 5 minutes for active/degraded agents
- Auto-fallback: if primary agent fails, route to next best in same category (up to 3 fallbacks)
- Auth forwarding: Bearer token or API key header to agent endpoint

---

## 12. Security Protocols

### Existing (keep)
- SSRF protection on endpoint URLs (no private IPs)
- Prompt injection scanning on agent metadata
- Response sanitisation (XSS, prototype pollution)
- Token encryption at rest (AES-256-GCM)
- Rate limiting per subscriber per plan

### Added by this design
- Opus security red-teaming during screening (prompt injection resistance, PII probes)
- Ongoing call sampling for security (1% via Haiku, escalation to Opus)
- Registration deposit as economic deterrent against malicious registrations
- Automatic suspension on security re-screening failure

---

## 13. Payment Infrastructure & Stripe Connect

### Business model: Marketplace

Stripe Connect configured as **Marketplace** (not Platform). Subscribers pay House of Agents (Tanbark Ventures is the merchant of record), and the platform distributes funds to providers.

This is the only model that supports revenue pooling — there is no 1:1 payment relationship between a subscriber and a specific provider.

### Provider payout architecture

1. Subscriber payments collected via Stripe Subscriptions → funds held in platform's Stripe account
2. Provider earnings calculated monthly based on quality-weighted call volume (see Section 5)
3. Provider requests cash-out via dashboard (minimum $50)
4. Platform calls Stripe Transfer API to send funds to provider's Express account
5. Provider's Express account pays out to their bank

**Critical rule: All funds remain in Stripe until provider payout. Money never moves to the platform's bank account before distribution.** This is essential for regulatory compliance — Stripe (as a licensed payment processor) holds the funds, not Tanbark Ventures.

### Provider payout fees (passed to provider)

| Fee | Amount | Bearer |
|-----|--------|--------|
| Express account fee | ~$2/mo | Provider (deducted from payout) |
| ACH withdrawal fee | $0.25 per payout | Provider (deducted from payout) |

These fees are transparently displayed on the provider dashboard before cash-out.

### Provider dashboard display

```
EARNINGS
├── This month (accruing):     $147.30
├── Available balance:         $89.20
├── Payout fee:                -$2.00
├── Withdrawal fee (ACH):      -$0.25
├── Next payout:               $86.95 (on request, min $50)
└── Lifetime earned:           $412.50
```

### Stripe Connect implementation

Uses Express accounts (already scaffolded in codebase):
- Provider onboarding: Stripe-hosted KYC flow → Express account created
- Stripe handles identity verification, bank details, tax form collection
- Platform never stores or sees provider bank details
- 1099 tax reporting handled by Stripe (enable from day one)

### What's code vs configuration

| Item | Where |
|------|-------|
| Funds held in Stripe before payout | Stripe dashboard — don't enable auto-withdraw |
| KYC/identity verification | Stripe Express onboarding — automatic |
| Tax reporting (1099s) | Stripe Connect settings — toggle on |
| Payout schedule | Stripe dashboard — set to manual |
| Transfer API calls on cash-out | Code — future implementation |
| Provider earnings calculation | Code — computed on-the-fly from ApiCall + Review data, no balance stored |

---

## 14. Compliance & Regulatory

### Platform compliance status

| Area | Status | Notes |
|------|--------|-------|
| PCI DSS | Compliant | Stripe handles all card data — platform never touches it |
| Encryption at rest | Compliant | AES-256-GCM for auth tokens, bcrypt for passwords |
| Input validation | Strong | Zod schemas, prompt injection scanning, XSS sanitisation |
| SSRF protection | Strong | Private IP blocking, HTTPS enforcement |
| Security headers | Strong | X-Frame-Options, CSP, HSTS via middleware |
| Rate limiting | Adequate | Per-plan limits, atomic DB-level enforcement |

### Critical gaps to address

| Gap | Severity | Resolution | Type |
|-----|----------|-----------|------|
| Privacy Policy page | Critical | Create `/privacy` page — currently 404 | Code |
| Terms of Service page | Critical | Create `/terms` page — currently 404 | Code |
| Cookie/storage consent | Critical | Add consent banner before storing API keys in localStorage | Code |
| Data deletion endpoint | Critical | GDPR "right to be forgotten" — `/api/account/delete` | Code |
| JWT fallback secret | Medium | Remove hardcoded `'fallback-dev-secret'` from jwt.ts | Code |
| Data retention policy | Medium | Auto-purge API logs (90d), health checks (30d) | Code |
| CORS dev mode | Medium | Don't allow any origin in production builds | Code |

### Australian regulatory considerations (Tanbark Ventures)

**Requires legal consultation before scaling:**

1. **AUSTRAC registration** — Does the revenue pool model require registration as a remittance service provider under the AML/CTF Act 2006? Key argument: Stripe (licensed) holds and transmits funds, not Tanbark Ventures. Needs lawyer sign-off.

2. **AFSL (ASIC)** — Does holding subscription revenue before provider distribution constitute a financial service? If funds remain in Stripe (not platform's bank account), strong argument for exemption. Needs lawyer sign-off.

3. **GST** — If turnover exceeds AUD $75K, GST registration required. Digital services to international subscribers have specific GST rules.

4. **Privacy Act 1988** — Collecting payment information from international users triggers Australian Privacy Principles (APPs). Cross-border disclosure (to Stripe, US entities) requires APP 8 compliance.

**Mitigation architecture:**
- All funds held in Stripe, never in platform bank account before distribution
- Stripe handles KYC, identity verification, bank details storage
- Platform never stores or processes financial PII directly
- Compliance rationale documented (this section) — essential if regulator inquires

### Compliance action items

**Before taking real payments:**
1. Create Privacy Policy and Terms of Service pages
2. Add localStorage consent banner
3. Remove JWT fallback secret
4. Enable Stripe Connect 1099 reporting

**Before significant revenue (~$50K+ MRR):**
1. 30-minute consultation with Australian fintech lawyer on AUSTRAC/AFSL
2. Document compliance rationale for fund flow architecture
3. Review data retention and implement auto-purge

---

## 15. Open Items / Future Considerations

- **Opus screening skill design:** Detailed test suite definitions per category, prompt engineering for evaluation, gaming prevention — requires separate deep-dive spec
- **Stripe Transfer API integration:** Code for provider cash-out requests — trigger transfer to Express account on demand
- **Provider earnings view:** Compute earnings on-the-fly from ApiCall + Review records — no stored balance, no financial PII
- **Team seats:** Double-0 tier mentions team seats but not modelled in database
- **MCP connector type:** Field exists in schema but proxy layer only handles API type
- **Enterprise tier:** Custom pricing for 400K+ calls/month — trigger and process TBD
- **Notification system:** Email/webhook notifications for usage alerts, auto-upgrades, screening results
- **Distributed rate limiting:** Move from DB-based to Redis-based for horizontal scaling
- **Data retention cron:** Auto-purge old API logs, health checks, benchmark records
