# House of Agents — Cost Model & Economics Reference

**Date:** 2026-04-13
**Status:** Living document — update when pricing, models, or tiers change
**Related spec:** [Agent Deployment & API Architecture Design](./2026-04-13-agent-deployment-api-architecture-design.md)

---

## 1. Subscription Tiers

| Tier | Monthly price | Calls included | Overage rate | Messaging channels | Target user |
|------|-------------|----------------|-------------|-------------------|-------------|
| **Recruit** | $0 | 500 | Hard cap, no overage | API only | Evaluation, hobby |
| **Field Agent** | $19 | 5,000 | $0.003/call | API + Telegram/WhatsApp | Hobbyists, early builders |
| **Double-0** | $79 | 50,000 | $0.002/call | API + Telegram/WhatsApp | Developers, small teams |
| **Shadow** | $249 | 500,000 | $0.001/call | All + priority routing | Production workloads |

### Effective per-call rates

| Tier | Included rate ($/call) | Overage rate | Auto-upgrade trigger |
|------|----------------------|-------------|---------------------|
| Recruit | $0.000 (free) | N/A (hard cap) | N/A |
| Field Agent | $0.0038 | $0.003 | When total bill reaches $79 (D0 price) |
| Double-0 | $0.0016 | $0.002 | When total bill reaches $249 (Shadow price) |
| Shadow | $0.0005 | $0.001 | Enterprise conversation at 2x quota (1M calls) |

---

## 2. Revenue Split

### Subscription revenue: 65/35 (Provider/Platform)

| Party | Share | Justification |
|-------|-------|---------------|
| Provider pool | 65% | Competitive with industry (Shopify 85%, Apple 70%, RapidAPI 80%). Platform provides demand, routing, screening, billing. |
| Platform | 35% | Covers Stripe fees, Opus operations, infrastructure, and margin. |

### Overage revenue: 50/50

| Party | Share | Justification |
|-------|-------|---------------|
| Provider pool | 50% | Lower share because overage is premium/burst usage |
| Platform | 50% | Higher cut covers incremental processing and infrastructure |

### Quality-weighted provider pool distribution

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

---

## 3. LLM Model Pricing (as of April 2026)

### Anthropic Claude API

| Model | Input / MTok | Output / MTok | Cache read (0.1x) | Batch (0.5x) |
|-------|-------------|---------------|-------------------|--------------|
| **Haiku 4.5** | $1.00 | $5.00 | $0.10 | $0.50 / $2.50 |
| **Sonnet 4.6** | $3.00 | $15.00 | $0.30 | $1.50 / $7.50 |
| **Opus 4.6** | $5.00 | $25.00 | $0.50 | $2.50 / $12.50 |

### Competitive reference

| Model | Input / MTok | Output / MTok |
|-------|-------------|---------------|
| GPT-4o mini | $0.15 | $0.60 |
| GPT-4o | $2.50 | $10.00 |
| Gemini 2.0 Flash | $0.10 | $0.40 |
| Gemini 2.5 Pro | $1.25 | $10.00 |

### Typical token counts per operation

| Operation | Input tokens | Output tokens | Total |
|-----------|-------------|---------------|-------|
| Haiku routing classification | ~300 (200 cached + 100 new) | ~50 | ~350 |
| Opus initial screening (per agent) | ~10,000 | ~3,000 | ~13,000 |
| Opus monthly re-screening (lighter) | ~5,000 | ~1,500 | ~6,500 |
| Haiku call quality sampling | ~800 | ~200 | ~1,000 |
| Opus escalation on flagged sample | ~2,000 | ~500 | ~2,500 |
| Haiku semantic search fallback | ~300 | ~100 | ~400 |

---

## 4. Platform Cost Per Operation

### LLM operations

| Operation | Model | Cost per unit | Notes |
|-----------|-------|--------------|-------|
| **Telegram/WhatsApp routing** | Haiku 4.5 | $0.0004 | System prompt cached. Per new conversation, not per message. |
| **Opus initial screening** | Opus 4.6 | ~$1.30 | 3-5 category-specific tasks + security red-teaming |
| **Opus monthly re-screening** | Opus 4.6 | ~$0.45 | Lighter suite than initial |
| **Haiku call quality sampling** | Haiku 4.5 | ~$0.001 | 1% of all calls sampled |
| **Opus escalation (flagged samples)** | Opus 4.6 | ~$0.02 | 5% of Haiku-flagged samples |
| **Opus dispute investigation** | Opus 4.6 | ~$0.50 | On subscriber report |
| **Haiku semantic search fallback** | Haiku 4.5 | ~$0.0004 | Only on zero-result web searches |

### Infrastructure

| Cost | Monthly | Notes |
|------|---------|-------|
| Railway hosting | ~$30 | Scales with traffic |
| Redis (Railway addon) | ~$10 | Rate limiting, sessions, leaderboard |
| Postgres | Included | Railway managed database |
| Domain/DNS | ~$1 | Annual amortised |

### Payment processing (Stripe)

| Fee | Amount | Notes |
|-----|--------|-------|
| Subscription processing | 2.9% + $0.30/txn | Per subscription payment |
| Deposit refund loss | ~$1.72/refund | Stripe keeps fee on refunds |
| Connect Express account | ~$2/mo/provider | Deducted from provider payout |
| ACH withdrawal | $0.25/payout | Deducted from provider payout |

---

## 5. Scenario Models

### 100 Users (Early Stage)

**User distribution:**

| Segment | Count | Avg calls/mo | Total calls/mo | Revenue |
|---------|-------|-------------|----------------|---------|
| Recruit (free) | 70 | 200 | 14,000 | $0 |
| Field Agent | 22 | 2,000 | 44,000 | $418 |
| Double-0 | 7 | 15,000 | 105,000 | $553 |
| Shadow | 1 | 100,000 | 100,000 | $249 |
| Overage | ~5 users | — | — | $50 |
| **Total** | **100** | | **~263,000** | **$1,270** |

**Platform P&L:**

| | Monthly |
|---|---------|
| Subscription revenue | $1,220 |
| Overage revenue | $50 |
| **Platform share (35% subs + 50% overage)** | **$452** |
| Provider pool (65% subs + 50% overage) | $818 |

**Platform costs:**

| Cost | 10% Telegram | 25% Telegram | 50% Telegram |
|------|-------------|-------------|-------------|
| Haiku routing | $0.20 | $0.50 | $1.00 |
| Opus screening (initial, ~5 agents) | $6.50 | $6.50 | $6.50 |
| Opus re-screening (~15 agents) | $6.75 | $6.75 | $6.75 |
| Haiku call sampling (1%) | $2.63 | $2.63 | $2.63 |
| Opus escalation (5% of sampled) | $2.64 | $2.64 | $2.64 |
| Opus disputes | $1.00 | $1.00 | $1.00 |
| Infrastructure | $41 | $41 | $41 |
| Stripe processing | $45 | $45 | $45 |
| **Total costs** | **$106** | **$106** | **$107** |
| **Net platform profit** | **$346** | **$346** | **$345** |
| **Margin** | **77%** | **77%** | **76%** |

**Key insight:** At 100 users, Telegram routing cost is negligible ($0.20-$1.00/mo). LLM costs are dominated by Opus screening (~$17/mo), not routing. Haiku routing scales with message volume but remains cheap.

### 1,000 Users (6 months)

**User distribution:**

| Segment | Count | Avg calls/mo | Total calls/mo | Revenue |
|---------|-------|-------------|----------------|---------|
| Recruit | 600 | 300 | 180,000 | $0 |
| Field Agent | 280 | 3,000 | 840,000 | $5,320 |
| Double-0 | 100 | 25,000 | 2,500,000 | $7,900 |
| Shadow | 20 | 200,000 | 4,000,000 | $4,980 |
| Overage | ~30 users | — | — | $240 |
| **Total** | **1,000** | | **~7.5M** | **$18,440** |

**Platform P&L:**

| | Monthly |
|---|---------|
| Platform share (35% + 50%) | $6,574 |
| LLM costs (all operations) | ~$180 |
| Infrastructure | ~$80 |
| Stripe processing | ~$350 |
| **Total costs** | **~$610** |
| **Net platform profit** | **~$5,964** |
| **Margin** | **91%** |

### 10,000 Users (18 months)

| | Monthly |
|---|---------|
| Subscription revenue | ~$120,000 |
| Platform share (35% + 50%) | ~$43,000 |
| LLM costs | ~$800 |
| Infrastructure | ~$300 |
| Stripe processing | ~$3,800 |
| **Total costs** | **~$4,900** |
| **Net platform profit** | **~$38,100** |
| **Margin** | **89%** |

### Scaling projection table

| Metric | 100 users | 1,000 users | 10,000 users | 100,000 users |
|--------|-----------|-------------|--------------|---------------|
| Monthly calls | 263K | 7.5M | 75M | 750M |
| Revenue | $1,270 | $18,440 | $120,000 | $900,000 |
| Platform share | $452 | $6,574 | $43,000 | $320,000 |
| Total costs | $106 | $610 | $4,900 | $45,000 |
| Net profit | $346 | $5,964 | $38,100 | $275,000 |
| Margin | 77% | 91% | 89% | 86% |
| LLM as % of costs | 18% | 30% | 16% | 12% |
| Stripe as % of costs | 42% | 57% | 78% | 82% |

**Key insight:** At scale, Stripe processing fees dominate costs (82%), not LLM operations (12%). The BYOH model means LLM costs scale with agents (hundreds-thousands) not calls (millions). Stripe fees scale linearly with revenue.

---

## 6. Agent Registration Deposit Economics

### Deposit: $49 (refundable)

| Event | Financial impact |
|-------|-----------------|
| Deposit charged | +$49 revenue, -$1.72 Stripe fee = $47.28 net |
| Deposit refunded (criteria met) | -$49 refund to provider. Stripe keeps $1.72. **Platform cost: $1.72** |
| Deposit forfeited (quality/security) | $47.28 retained by platform |
| Partial refund ($25) | -$25 refund. **Platform retains $22.28** |

### Refund criteria

| Scenario | Refund |
|----------|--------|
| 0 calls in 90 days | Full $49 |
| 1-50 calls, no rating below 3.0 | Full $49 |
| 50+ calls, avg rating ≥ 3.5, uptime ≥ 90% | Full $49 |
| 50+ calls, avg rating 3.0-3.5 | Partial $25 |
| 50+ calls, avg rating < 3.0 | Forfeited |
| Uptime < 80% for 30+ consecutive days | Forfeited |
| Security violation | Forfeited |

### Deposit launch strategy

- **V1 launch:** First agent free (no deposit). Deposit UI shown but not charged.
- **FF-1:** Stripe deposit integration. Second+ agents require deposit.
- **FF-3:** Verified GitHub (>1yr, >10 repos) reduces deposit to $19.

---

## 7. Messaging Channel Cost Analysis

### Routing cost: Haiku classification

- **Per classification:** ~$0.0004
- **When triggered:** Once per new conversation (not per message within a session)
- **Absorbed by:** Platform (baked into 35% take rate)

### Session-depth weighting (messaging only)

| Session turn | Calls deducted per message |
|-------------|--------------------------|
| Turn 1-3 | 1 call |
| Turn 4-7 | 2 calls |
| Turn 8-15 | 3 calls |
| Turn 16+ | 5 calls |

**API calls:** Always 1 call = 1 call (flat).

### Telegram vs WhatsApp platform costs

| | Telegram | WhatsApp (via Twilio) |
|---|---------|---------------------|
| API cost | Free | $0.005-0.08/msg (varies by country) |
| Setup | BotFather (free) | Twilio account + WhatsApp Business approval |
| Recommendation | **V1 launch** | **FF-6 (fast-follow)** |

### Messaging cost by Telegram adoption (100 users)

| Telegram adoption | Routing cost/mo | % of platform share |
|-------------------|----------------|-------------------|
| 10% | $0.20 | 0.04% |
| 25% | $0.50 | 0.11% |
| 50% | $1.00 | 0.22% |

**Verdict:** Telegram routing cost is negligible at all adoption levels with Haiku. No surcharge needed.

---

## 8. Usage Governance Costs

### Rolling daily replenishment

| Tier | Daily replenishment | Daily ceiling |
|------|-------------------|--------------|
| Recruit | ~17/day | 34 |
| Field Agent | ~167/day | 334 |
| Double-0 | ~1,667/day | 3,334 |
| Shadow | ~16,667/day | 33,334 |

**Implementation cost:** Daily cron job. No LLM cost. Pure DB operation.

### Burst protection (Redis)

| Tier | Calls/min | Calls/hour | Concurrent per agent |
|------|----------|-----------|---------------------|
| Recruit | 5 | 60 | 1 |
| Field Agent | 30 | 500 | 3 |
| Double-0 | 100 | 2,000 | 10 |
| Shadow | 500 | 10,000 | 25 |

**Implementation cost:** Redis INCR + EXPIRE. Negligible — within existing Redis allocation.

---

## 9. Update Log

| Date | Change | Reason |
|------|--------|--------|
| 2026-04-13 | Initial document | Created during agent deployment architecture design |

*When updating this document: add a row to the update log, revise affected sections, verify scenario models still hold.*
