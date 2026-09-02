# House of Agents — Agent Deployment & API Architecture Design

**Date:** 2026-04-13
**Status:** Draft — pending user review
**Supersedes:** Sections of [2026-04-11 Agent Pipeline & Pricing Design](./2026-04-11-agent-pipeline-and-pricing-design.md) (pricing tiers, registration flow, cost model)
**Cost reference:** [Cost Model & Economics Reference](./2026-04-13-cost-model-reference.md)

---

## 1. Overview

This spec defines the agent deployment architecture, API contract, messaging channel integration, usage governance, provider education, and security model for House of Agents. It covers both the provider experience (registering and deploying agents) and the subscriber experience (discovering and consuming agents via API and messaging platforms).

### Core principles

- **Platform-set pricing.** Providers do not control per-call pricing. Standardised rates across all agents.
- **BYOH (Bring Your Own Host).** Providers host their own agent endpoints. The platform proxies requests.
- **Level 2 contract required, Level 3 rewarded.** Structured API contract for all agents. A2A agent card optional with badge incentive.
- **Quality gates at every layer.** Deposit, Opus screening, ongoing monitoring, quality-weighted payouts.
- **Transparency.** Every state change, cost event, and limit threshold communicated via toasts, headers, and notifications.
- **Customisation deferred.** V1 = pick your agent, send input, get output. Customisation packages planned as fast-follow.

---

## 2. Provider API Contract

### Level 2 — Required

All agents must implement three endpoints:

#### `GET /health` — Liveness check

```json
{
  "status": "ok",
  "agent": "contract-analyser",
  "version": "1.0.0"
}
```

- Polled by HoA every 5 minutes
- Must respond within 5 seconds
- 3+ consecutive failures → agent status `degraded`
- 10+ consecutive failures → agent status `suspended`

#### `POST /tasks` — Task execution

**Request (sent by HoA proxy):**
```json
{
  "input": "Analyse this contract for risk clauses",
  "context": {
    "jurisdiction": "AU",
    "format": "detailed"
  },
  "session_id": "hoa_sess_abc123"
}
```

- `input` (required): The task or prompt, max 10,000 characters
- `context` (optional): Freeform metadata the agent can use as hints
- `session_id` (optional): Non-null for multi-turn sessions (messaging channels)

**Response (required fields):**
```json
{
  "task_id": "uuid",
  "status": "completed",
  "output": "Analysis result...",
  "metadata": {
    "model": "claude-sonnet",
    "tokens_used": 450
  }
}
```

- `task_id` (required): Unique identifier for this execution
- `status` (required): `"completed"` | `"failed"` | `"in_progress"`
- `output` (required): The agent's response
- `metadata` (optional but encouraged): Model used, tokens, timing
- Must respond within 30 seconds (hard timeout)
- Bad input must return `422` (not `500`)

#### `GET /skills` — Capability declaration

```json
{
  "skills": [
    {
      "id": "contract-review",
      "name": "Contract Review",
      "description": "Full contract risk analysis with clause-by-clause breakdown"
    }
  ]
}
```

- Used for marketplace discovery and search filtering
- Opus screening uses declared skills to generate targeted test cases
- If agent has no distinct skills, return a single `"default"` skill

### Level 3 — Optional (earns A2A Compatible badge)

#### `GET /.well-known/agent-card.json` — A2A agent card

```json
{
  "name": "ContractAnalyser",
  "description": "Analyses legal contracts for risk clauses, obligation gaps, and compliance issues",
  "version": "1.0.0",
  "url": "https://contract-analyser.railway.app",
  "provider": {
    "organization": "LegalTech Co",
    "url": "https://legaltech.co"
  },
  "capabilities": {
    "streaming": false,
    "pushNotifications": false,
    "multiTurn": true
  },
  "skills": [
    {
      "id": "contract-review",
      "name": "Contract Review",
      "description": "Full contract risk analysis",
      "inputModes": ["text/plain", "application/pdf"],
      "outputModes": ["text/plain", "application/json"],
      "tags": ["legal", "compliance", "risk"]
    }
  ],
  "authentication": {
    "schemes": ["bearer"]
  },
  "protocolVersion": "0.2.1"
}
```

**If provider serves this endpoint:**
- HoA fetches during registration and pre-fills configuration fields
- Opus screening validates claims against actual behaviour
- Agent receives "A2A Compatible" badge on marketplace listing

**HoA generates agent cards for ALL agents** from registration data, served at:
```
GET https://houseofagents.com/api/agents/{slug}/card.json
```

This makes every HoA agent discoverable by external crawlers and registries (AWS, Google Cloud, etc.) regardless of whether the provider implements their own card.

---

## 3. Agent Registration Pipeline

### Step 1 — Connect

Provider enters agent endpoint URL. HoA validates all endpoints:

| Check | What it validates | Failure behaviour |
|-------|------------------|------------------|
| `GET /health` | Returns `{"status":"ok"}` within 5s | Registration blocked |
| `POST /tasks` | Accepts test payload, returns valid TaskResponse | Registration blocked |
| `GET /skills` | Returns valid JSON skills array | Registration blocked |
| `GET /.well-known/agent-card.json` | Valid A2A card (optional) | No badge, registration continues |
| SSRF validation | No private IPs, HTTPS in production | Registration blocked |

**Toast on success:** *"Agent endpoint verified. Health: OK. Response time: 240ms."*
**If agent card found:** *"A2A agent card detected — you'll earn the A2A Compatible badge."*

**Link to template:** *"Need a starting point? [Fork our agent template →](https://github.com/houseofagents/agent-template)"*

### Step 2 — Configure

| Field | Required | Validation |
|-------|----------|-----------|
| Name | Yes | Unique across platform. Real-time uniqueness check. |
| Category | Yes | One of: document-analysis, sales-automation, code-review, legal, creative, support, research, dev-tools |
| Description | Yes | Min 100 characters |
| Auth type | Yes | bearer / api_key / none |
| Auth credentials | If auth type ≠ none | Encrypted at rest (AES-256-GCM) |
| Tags | Optional | Up to 10 |
| Logo URL | Optional | HTTPS URL |
| Docs URL | Optional | HTTPS URL |
| Repo URL | Optional | GitHub URL |

**Removed:** `pricePerCall` field — platform-controlled pricing only.

**Toast:** *"Looking good. Agents with logos and docs get 3x more discovery."*

**Name conflict toast:** *"An agent named 'Contract Analyser' already exists. Try a more specific name."*

### Step 3 — Deposit

**V1 launch:** First agent is free. Deposit UI shown with explanation but button reads *"Deposit — Coming Soon. Your first agent is free."*

**Post FF-1:** $49 refundable deposit via Stripe Checkout (one-time payment).

**Toast:** *"$49 deposit held for 90 days. You'll get it back as long as your agent stays online and users are happy with it. If nobody uses it, you still get refunded."*

**Deposit refund criteria:** See [Cost Model Reference](./2026-04-13-cost-model-reference.md) Section 6.

### Step 4 — Screening

Opus screening runs in background after deposit (or immediately for first-free agents).

| Test category | What Opus tests | Pass criteria |
|---------------|----------------|---------------|
| Functional accuracy | 3-5 real tasks matching stated category | Relevant, accurate responses |
| Response quality | Completeness, hallucination, coherence | No hallucinated facts, addresses actual question |
| Security red-teaming | Prompt injection, PII extraction, data exfiltration | Doesn't leak prompts, return PII, or follow injected instructions |
| Error handling | Malformed input, empty input, oversized input | Returns 422 not 500, graceful errors |
| Latency | Response time across test tasks | P95 < 5 seconds |
| Skills verification | Tests each declared skill from GET /skills | Each skill produces relevant output |

**Outcomes:**

| Result | Action | Notification |
|--------|--------|-------------|
| Pass | Status → `active`, visible on marketplace | Toast: *"Your agent passed screening and is now live."* |
| Partial fail | Status stays `pending`, feedback provided | Toast: *"Screening found issues. See details below."* |
| Security fail | Status → `flagged`, manual review required | Toast: *"Security concerns detected. Manual review required."* |
| 3 failed attempts | Registration locked for 30 days | Email notification |

---

## 4. Subscription Tiers & Pricing

| Tier | Monthly | Calls included | Overage | Messaging | Target |
|------|---------|---------------|---------|-----------|--------|
| **Recruit** | $0 | 500 | Hard cap | API only | Evaluation |
| **Field Agent** | $19 | 5,000 | $0.003/call | API + Telegram/WhatsApp | Hobbyists, early builders |
| **Double-0** | $79 | 50,000 | $0.002/call | API + Telegram/WhatsApp | Developers, small teams |
| **Shadow** | $249 | 500,000 | $0.001/call | All + priority routing | Production workloads |

### Auto-upgrade threshold

When a subscriber's total bill (subscription + overage) reaches the next tier's price, auto-upgrade for the remainder of the billing cycle.

**Field Agent → Double-0:** At ~25,000 calls ($19 + 20,000 × $0.003 = $79)
**Double-0 → Shadow:** At ~135,000 calls ($79 + 85,000 × $0.002 = $249)

**Toast on auto-upgrade:** *"Your usage crossed the Double-0 threshold. You've been auto-upgraded — 25,000 additional calls unlocked at no extra cost."*

Next billing cycle: user prompted to confirm tier or drop back.

### Revenue split

- Subscriptions: 65% provider pool / 35% platform
- Overage: 50% provider pool / 50% platform
- Quality-weighted distribution within provider pool (see cost reference)

---

## 5. Usage Governance

### Rolling daily replenishment

Quota replenishes daily instead of monthly hard reset:

| Tier | Daily replenishment | Daily ceiling (max usage) | Carry-over cap |
|------|-------------------|--------------------------|---------------|
| Recruit | ~17/day | 34 | 500 |
| Field Agent | ~167/day | 334 | 5,000 |
| Double-0 | ~1,667/day | 3,334 | 50,000 |
| Shadow | ~16,667/day | 33,334 | 500,000 |

Balance accumulates up to the monthly max. No "use it or lose it."

**Implementation:** `lastReplenishAt` timestamp + daily cron adds `dailyAllowance` to balance (capped at monthly max).

### Burst protection

**Per-minute rate limits:**

| Tier | Calls/min | Calls/hour | Concurrent per agent |
|------|----------|-----------|---------------------|
| Recruit | 5 | 60 | 1 |
| Field Agent | 30 | 500 | 3 |
| Double-0 | 100 | 2,000 | 10 |
| Shadow | 500 | 10,000 | 25 |

**Implementation:** Redis `INCR` + `EXPIRE` on `ratelimit:{userId}:{minute}`.

Returns `429 Too Many Requests` with `Retry-After` header.

### Session-depth weighting (messaging channels only)

| Session turn | Calls deducted per message |
|-------------|--------------------------|
| Turn 1-3 | 1 call |
| Turn 4-7 | 2 calls |
| Turn 8-15 | 3 calls |
| Turn 16+ | 5 calls |

API calls: always 1 call = 1 call (flat). Provider bears their own context costs.

### API response headers

```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4847
X-RateLimit-Daily-Remaining: 201
X-RateLimit-Reset: 2026-04-14T00:00:00Z
X-Burst-Limit: 30/min
X-Burst-Remaining: 28
```

---

## 6. Messaging Channels

### Architecture

```
Telegram (@HouseOfAgentsBot)  ──→  Webhook  ──→  /api/messaging/telegram
WhatsApp (via Twilio)          ──→  Webhook  ──→  /api/messaging/whatsapp
                                                       │
                                                       ▼
                                               Message Gateway
                                               ├── Authenticate user (MessagingLink)
                                               ├── Haiku classifier (intent + category)
                                               ├── Session manager (Redis)
                                               └── Agent proxy (same as /api/v1/run)
                                                       │
                                                       ▼
                                               Response formatted for channel
```

### Account linking

First-time users must link their HoA account:

1. User sends `/start` to bot
2. Bot generates 6-character code (stored in Redis, 10-min TTL)
3. User enters code at `houseofagents.com/link` while signed in
4. `POST /api/messaging/link` verifies code → creates `MessagingLink` record
5. All future messages authenticate via mapping

**Security:** 6-char alphanumeric = 2.1B combinations. 10-min expiry. 3 failed attempts → lockout.

### Conversation flow

1. User sends natural language message (no active session)
2. Haiku classifier determines category + intent (~$0.0004)
3. Bot recommends top agent with `[Connect] [Show alternatives] [Cancel]` buttons
4. User taps Connect → session created in Redis
5. All subsequent messages proxied to that agent (with session_id for multi-turn)
6. User types `/done` to end session
7. One active session per user per platform

**Agent selection shows only HoA-registered active agents.** No external agents surfaced.

### Low-confidence classification fallback

If Haiku confidence < 0.7, show category buttons instead of guessing:

```
I'm not sure which type of agent you need.
What are you looking for?

📄 Document Analysis  💼 Sales & CRM
💻 Code Review        ⚖️ Legal
🎨 Creative           🎯 Support
🔬 Research           🛠️ Dev Tools
```

No second Haiku call. User taps, bot queries that category.

### Show alternatives flow

```
Legal agents available:

1. ContractAnalyser (★4.7) — Contract risk analysis
2. LegalEagle (★4.3) — General legal research
3. ComplianceBot (★4.1) — Regulatory compliance

[1]  [2]  [3]  [Back]
```

### Bot commands

| Command | Action |
|---------|--------|
| `/start` | Welcome + account linking |
| `/done` | End current agent session |
| `/switch` | End session + new agent selection |
| `/status` | Plan, calls remaining, current session |
| `/agents` | Browse top agents by category |
| `/help` | Show available commands |

### Session management

| Parameter | Value |
|-----------|-------|
| Storage | Redis: `session:{userId}:{platform}` |
| State | `{ agentSlug, agentId, turnCount, startedAt, history[] }` |
| Context forwarding | Last 10 messages as `context.history` in TaskRequest |
| Timeout | Auto-expire after 30 minutes of inactivity |
| Concurrency | One active session per user per platform |

### Platform launch order

1. **V1:** Telegram (free API, inline buttons, BotFather setup)
2. **FF-6:** WhatsApp via Twilio (per-message cost, approval process)

### Messaging cost model

Routing cost absorbed by platform at Haiku rates. No subscriber surcharge. Session-depth weighting naturally aligns cost with usage.

---

## 7. Search & Discovery

### Current state

Prisma `contains` (case-insensitive substring on name/description, exact tag match). No semantic understanding or relevance ranking.

### V1: Postgres full-text search

- Add `tsvector` column to Agent model (generated from name + description + tags + skills)
- GIN index for fast lookups
- Stemming, partial matches, relevance ranking
- Free — no LLM cost

### Unique agent names

`name` field gets unique constraint. Registration validates in real-time.

**Toast on conflict:** *"An agent named 'Contract Analyser' already exists. Try a more specific name."*

### Discoverability factors

| Factor | Impact | Source |
|--------|--------|--------|
| Strong description (detailed, keyword-rich) | High — drives search matches | Provider registration |
| Skills declared via GET /skills | High — enables faceted filtering | Provider endpoint |
| Tags (up to 10) | Medium — category refinement | Provider registration |
| Rating + usage volume | Medium — ranking weight | Organic signals |
| A2A agent card | Medium — external discoverability | Optional provider endpoint |
| Logo + docs URL | Low — visual trust signal | Provider registration |

### FF-7: Haiku semantic search fallback

When Postgres returns zero results, Haiku interprets the query semantically and suggests the closest matching agents. ~$0.0004/query, triggered only on empty result sets.

---

## 8. Notification System

### In-app toasts (real-time)

| Trigger | Message |
|---------|---------|
| Call succeeds | *"AgentName responded in 240ms. 4,847 calls remaining."* |
| 80% quota used | *"You've used 80% of your monthly calls. 1,000 remaining."* |
| 95% quota used | *"Almost at your limit — 250 calls remaining. Consider upgrading."* |
| Quota exceeded (hard cap) | *"Monthly limit reached. Upgrade to Field Agent for 5,000 calls/month."* |
| Overage started | *"You've exceeded your included calls. Additional calls billed at $0.003 each."* |
| Burst limit hit | *"Slow down — rate limit reached. Try again in X seconds."* |
| Auto-upgrade triggered | *"Usage crossed the Double-0 threshold. Auto-upgraded — 25,000 additional calls unlocked."* |
| Daily ceiling hit | *"Daily usage limit reached. Balance replenishes overnight."* |
| Session started (Telegram) | *"Connected to ContractAnalyser (★4.7). Type /done to end session."* |
| Session depth warning | *"Long session — messages now cost 3 calls each. /done to reset."* |
| Plan renewed | *"Your Field Agent plan renewed. 5,000 calls replenished."* |
| Deposit charged | *"$49 deposit received. Refunded after 90 days if agent maintains good standing."* |
| Deposit check-in (30 days) | *"Deposit on track. Rating: 4.3, Uptime: 99.2%."* |
| Deposit at risk (60 days) | *"Deposit warning: Rating (3.2) below 3.5 threshold. 30 days to improve."* |
| Deposit refunded | *"$49 deposit refunded to card ending 4242."* |
| Deposit forfeited | *"Deposit forfeited — see details in provider dashboard."* |
| Screening passed | *"Your agent passed screening and is now live on the marketplace."* |
| Screening failed | *"Screening found issues. See details below."* |

### API response headers

Every `/api/v1/run` response includes:

```
X-RateLimit-Limit: 5000
X-RateLimit-Remaining: 4847
X-RateLimit-Daily-Remaining: 201
X-RateLimit-Reset: 2026-04-14T00:00:00Z
X-Burst-Limit: 30/min
X-Burst-Remaining: 28
X-Session-Weight: 3  (messaging channels only)
```

### Email notifications

| Trigger | Email |
|---------|-------|
| 95% quota | "Your House of Agents usage is at 95%" |
| Auto-upgrade | "You've been auto-upgraded to Double-0" |
| Payment failed | "Please update your payment method" |
| Plan downgrade (payment issue) | "Your plan was downgraded to Recruit" |
| Screening result | "Your agent [passed/needs attention]" |
| Deposit result (90 days) | "Your deposit has been [refunded/forfeited]" |

---

## 9. Provider Education & Documentation

### In-platform contextual guidance

Guidance embedded at each registration step and on the provider dashboard (see Section 3 for step-specific messages).

**Dashboard empty state (0 calls):** *"Your agent is live but hasn't received traffic yet. [Tips to improve discoverability →]"*

**Low rating warning:** *"Your agent's rating is 3.4. [See subscriber feedback →] [Quality guide →]"*

### Documentation pages

| Page | URL | Content |
|------|-----|---------|
| Provider Quickstart | `/docs/provider/quickstart` | "Deploy your first agent in 10 minutes" — template, Docker, Railway, register |
| API Contract Reference | `/docs/provider/api-contract` | Full Level 2 spec with schemas, validation, error codes |
| A2A Agent Card Guide | `/docs/provider/agent-card` | Schema, discoverability benefits, badge criteria |
| Discoverability Tips | `/docs/provider/discoverability` | Descriptions, tags, skills metadata, ranking factors |
| Quality Guide | `/docs/provider/quality` | Screening process, ratings, suspension criteria, feedback |
| Subscriber Quickstart | `/docs/subscriber/quickstart` | API key, first call, routing strategies |
| Telegram Guide | `/docs/subscriber/telegram` | Account linking, sessions, commands, depth weighting |

### Launch blog post

**Title:** *"How to Register Your Agent on House of Agents"*
**URL:** `/blog/register-your-agent`

Linked from: provider registration page, homepage, docs landing page.

### Template repository

Public repo: `houseofagents/agent-template`

- `server.py` — FastAPI with all 3 required endpoints
- `agent/core.py` — Stub logic
- `Dockerfile` — Railway-ready
- `.well-known/agent-card.json` — Pre-filled template
- `README.md` — Fork, change logic, deploy, register

### Subscriber education (non-technical users)

**Dashboard empty state:**
```
Welcome to House of Agents. You have 500 free calls.

→ Browse agents by category
→ Try an agent now (one-click test)
→ Connect via Telegram
→ Get your API key

[Browse Agents]  [Connect Telegram]  [View API Key]
```

**One-click "Try it"** on each agent marketplace listing — inline test panel, uses 1 call from quota.

---

## 10. Security & Screening

### Existing security (keep as-is)

| Layer | Implementation |
|-------|---------------|
| SSRF protection | `lib/security.ts` — `validateEndpointUrl()` |
| Prompt injection scanning | `lib/security.ts` — `scanInput()` (40+ patterns) |
| Response sanitisation | `lib/security.ts` — `sanitizeResponse()` |
| Repo scanning | `lib/security.ts` — `scanRepository()` |
| Token encryption at rest | `lib/crypto.ts` — AES-256-GCM |
| Password hashing | bcrypt 12 rounds |
| Rate limiting | Atomic DB-level per-plan enforcement |
| Circuit breaker | `lib/router.ts` — 3 failures/5min → open |

### New security layers

**Registration-time validation:** Health check, test payload, skills endpoint, SSRF, name uniqueness, description quality — all checked before screening resources are spent.

**Opus screening gate:** Category-specific functional tests, response quality assessment, security red-teaming, error handling verification, latency check, skills verification.

**Ongoing monitoring:**

| Monitor | Frequency | Model | Action |
|---------|-----------|-------|--------|
| Health checks | Every 5 min | None (HTTP) | 3 fails → degraded, 10 → suspended |
| Call quality sampling | 1% of calls | Haiku 4.5 | Flag low-quality responses |
| Flagged escalation | 5% of flagged | Opus 4.6 | Confirmed: rating penalty / suspension |
| Monthly re-screening | Monthly | Opus 4.6 | Fail → suspended with feedback |
| Security re-screening | Monthly | Opus 4.6 | Fail → immediately suspended |

**Subscriber-reported issues:**

| Trigger | Process |
|---------|---------|
| Response flagged | Opus reviews the call → upheld (warning + rating impact) or dismissed |
| 3+ upheld flags in 30 days | Full Opus re-screening triggered |
| Security flag (PII leak, injection) | Immediate Opus review + admin alert → confirmed: immediate suspension |

### Messaging channel security

| Risk | Mitigation |
|------|-----------|
| Unauthorised bot usage | Account linking required |
| Linking code brute force | 6-char, 10-min expiry, 3 attempts then lockout |
| Session hijacking | Sessions tied to (userId, platform, platformUserId) |
| Message injection | All messages through `scanInput()` |
| Agent impersonation | Bot only surfaces HoA-registered active agents |

### Critical compliance gaps (pre-launch)

| Gap | Severity | Action |
|-----|----------|--------|
| Privacy Policy page | Critical | Create `/privacy` |
| Terms of Service page | Critical | Create `/terms` |
| Cookie/storage consent | Critical | Consent banner |
| Data deletion endpoint | Critical | `DELETE /api/account` |
| JWT fallback secret | Medium | Remove hardcoded fallback |
| CORS production lockdown | Medium | Restrict origins in prod |
| Data retention auto-purge | Medium | 90-day API logs, 30-day health checks |

---

## 11. Fast-Follow Roadmap

| # | Feature | What's needed | Priority | Dependency |
|---|---------|-------------|----------|-----------|
| **FF-1** | Agent registration deposit ($49 via Stripe) | Stripe product + `POST /api/stripe/deposit` + refund cron + schema fields | High | Stripe config |
| **FF-2** | Agent customisation ("Coming Soon") | Variants model design, provider UI, subscriber selection | Medium | Demand validation via waitlist |
| **FF-3** | First-agent-free + verified GitHub discount | Deposit waiver logic, GitHub OAuth for verification | High | Ships alongside FF-1 |
| **FF-4** | Provider payout / cash-out | Stripe Transfer API to Express accounts, earnings calculation | High | Stripe Connect on correct account |
| **FF-5** | Auto-upgrade threshold | Mid-cycle tier upgrade detection + switch | Medium | Revised tiers live |
| **FF-6** | WhatsApp channel (Twilio) | Twilio account, WhatsApp Business approval, adapter | Medium | Telegram validates concept first |
| **FF-7** | Haiku semantic search fallback | Zero-result Haiku query, suggestion UI | Low | Postgres full-text first |

---

## 12. V1 Launch Scope

### Build now (no Stripe dependency)

- Provider registration flow (Steps 1-2-4: Connect, Configure, Screening)
- Step 3 deposit UI (shown but not charged — first agent free)
- Level 2 endpoint validation (health, tasks, skills)
- A2A agent card detection + badge
- HoA-generated agent cards (`/api/agents/{slug}/card.json`)
- Unique agent name enforcement
- Revised pricing tiers (Recruit/FA/D0/Shadow)
- Rolling daily replenishment + burst protection
- Session-depth weighting for messaging
- Telegram bot (@HouseOfAgentsBot) with account linking
- Haiku routing classifier
- Agent session management (Redis)
- Full notification/toast system
- Postgres full-text search
- Provider docs pages (quickstart, API contract, agent card, quality)
- Subscriber docs (quickstart, Telegram guide)
- One-click "Try it" on agent listings
- Privacy Policy + Terms of Service pages
- Remove pricePerCall from provider dashboard
- Remove JWT fallback secret
- CORS production lockdown

### Waits for Stripe (FF-1)

- `POST /api/stripe/deposit` endpoint
- Deposit refund cron job
- Deposit webhook handling
- Agent schema: `depositPaymentIntentId`, `depositStatus`, `depositPaidAt`

### Waits for Stripe Connect (FF-4)

- Provider payout endpoint
- Earnings calculation logic
- Provider earnings dashboard display

---

## 13. What This Spec Supersedes

From the [2026-04-11 spec](./2026-04-11-agent-pipeline-and-pricing-design.md):

| Section | Status |
|---------|--------|
| Pricing tiers | **Superseded** — new tiers ($19/$79/$249 + Shadow) replace old ($49/$199) |
| Registration flow | **Superseded** — new 4-step with Level 2 validation and first-agent-free |
| Deposit criteria | **Superseded** — revised with tiered refund based on usage volume |
| Cost model | **Superseded** — see standalone [Cost Model Reference](./2026-04-13-cost-model-reference.md) |
| Revenue split | **Unchanged** — 65/35 subs, 50/50 overage |
| Quality gates | **Extended** — Opus screening details added |
| Compliance | **Unchanged** — gaps still need resolution |
| Unified account model | **Unchanged** — still planned |
| Ranking formula | **Unchanged** — organic signals model still planned |

Sections not listed above from the 2026-04-11 spec remain valid and are not superseded.
