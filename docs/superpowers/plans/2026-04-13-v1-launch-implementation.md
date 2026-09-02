# V1 Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship House of Agents V1 with revised pricing, Level 2 provider validation, Telegram messaging, usage governance, and compliance fixes.

**Architecture:** Next.js 16 App Router with Prisma 7 + PostgreSQL + Redis. BYOH agent marketplace where providers host endpoints, platform proxies calls. Haiku for Telegram routing, Opus for agent screening. Sonner for toasts.

**Tech Stack:** Next.js 16.2.3, React 19, Prisma 7.7, PostgreSQL 16, Redis 7 (ioredis), Stripe 22, Tailwind CSS v4, Sonner 2, Zod 4, TypeScript 5

**Spec:** `docs/superpowers/specs/2026-04-13-agent-deployment-api-architecture-design.md`
**Cost reference:** `docs/superpowers/specs/2026-04-13-cost-model-reference.md`

**IMPORTANT:** Read the relevant Next.js 16 guide in `node_modules/next/dist/docs/` before writing any code. APIs may differ from training data.

---

## Phase 1: Schema & Foundation

These tasks are sequential — schema changes must land before anything else.

### Task 1: Prisma Schema — New Plan Tiers & Usage Governance Fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update User model with new plan types and usage governance fields**

In `prisma/schema.prisma`, update the User model. The `plan` field currently accepts `explorer`, `builder`, `scale`. Add `field_agent`, `double_0`, `shadow` as new values (we'll migrate existing users later). Add rolling replenishment fields:

```prisma
model User {
  id                String   @id @default(cuid())
  email             String   @unique
  name              String
  passwordHash      String?
  role              String   @default("subscriber")
  apiKey            String?  @unique
  plan              String   @default("recruit")
  callsUsed         Int      @default(0)
  callsLimit        Int      @default(500)
  callsBalance      Int      @default(500)
  dailyAllowance    Int      @default(17)
  dailyCeiling      Int      @default(34)
  lastReplenishAt   DateTime @default(now())
  stripeCustomerId  String?
  stripeAccountId   String?
  googleId          String?  @unique
  onboardingComplete Boolean @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  agents     Agent[]
  apiCalls   ApiCall[]
  sessions   Session[]
  reviews    Review[]
}
```

Key changes:
- `plan` default changed from `"explorer"` to `"recruit"`
- Added `callsBalance` (current available balance for rolling replenishment)
- Added `dailyAllowance` (calls replenished per day)
- Added `dailyCeiling` (max calls consumable per day)
- Added `lastReplenishAt` (timestamp for replenishment cron)
- Added `reviews` relation (for subscriber reviews)

- [ ] **Step 2: Update Agent model — add unique name, remove pricePerCall dependency, add deposit fields**

```prisma
model Agent {
  id             String   @id @default(cuid())
  slug           String   @unique
  name           String   @unique
  description    String
  shortDesc      String   @default("")
  category       String
  tags           String[] @default([])
  providerId     String
  provider       User     @relation(fields: [providerId], references: [id])
  endpointUrl    String
  connectorType  String   @default("api")
  authType       String   @default("none")
  authToken      String?
  pricingModel   String   @default("platform")
  pricePerCall   Int      @default(0)
  status         String   @default("pending")
  logoUrl        String?
  docsUrl        String?
  repoUrl        String?
  mcpServerUrl   String?

  // Performance metrics
  currentScore   Float    @default(0)
  latencyP50     Float?
  latencyP95     Float?
  uptime         Float    @default(100)
  errorRate      Float    @default(0)
  currentRank    Int?
  trendDelta     Float    @default(0)
  totalCalls     Int      @default(0)
  rating         Float?
  reviewCount    Int      @default(0)

  // A2A
  hasAgentCard   Boolean  @default(false)
  skillsData     Json?

  // Deposit (FF-1 prep)
  depositPaymentIntentId String?
  depositStatus          String?
  depositPaidAt          DateTime?

  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  benchmarks     Benchmark[]
  apiCalls       ApiCall[]
  healthChecks   HealthCheck[]
  reviews        Review[]

  @@index([category, status])
  @@index([status, currentScore(sort: Desc)])
}
```

Key changes:
- `name` gets `@unique` constraint
- Added `hasAgentCard` boolean for A2A badge
- Added `skillsData` JSON field to cache GET /skills response
- Added deposit fields (for FF-1 prep, nullable)
- `pricingModel` default changed to `"platform"`

- [ ] **Step 3: Add MessagingLink model for Telegram account linking**

Add to `prisma/schema.prisma`:

```prisma
model MessagingLink {
  id             String   @id @default(cuid())
  platform       String
  platformUserId String
  userId         String
  user           User     @relation(fields: [userId], references: [id])
  createdAt      DateTime @default(now())

  @@unique([platform, platformUserId])
  @@index([userId])
}
```

Also add the relation to the User model:
```prisma
  messagingLinks MessagingLink[]
```

- [ ] **Step 4: Run migration**

Run: `npx prisma migrate dev --name v1-launch-schema`

Expected: Migration creates successfully, applies to local database.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: schema updates for V1 launch — new tiers, usage governance, agent card, messaging"
```

---

### Task 2: Update Plan Constants Across Codebase

**Files:**
- Modify: `src/app/api/subscribers/register/route.ts:6-10`
- Modify: `src/app/api/stripe/webhook/route.ts:5-8`
- Modify: `src/app/api/auth/google/route.ts:83-86`
- Modify: `src/lib/validation.ts`
- Create: `src/lib/plans.ts`

- [ ] **Step 1: Create centralised plan config**

Create `src/lib/plans.ts` — single source of truth for all plan constants:

```typescript
export const PLANS = {
  recruit: {
    label: 'RECRUIT',
    price: 0,
    callsLimit: 500,
    dailyAllowance: 17,
    dailyCeiling: 34,
    burstPerMinute: 5,
    burstPerHour: 60,
    concurrentPerAgent: 1,
    overageRate: 0,
    messagingEnabled: false,
  },
  field_agent: {
    label: 'FIELD AGENT',
    price: 19,
    callsLimit: 5_000,
    dailyAllowance: 167,
    dailyCeiling: 334,
    burstPerMinute: 30,
    burstPerHour: 500,
    concurrentPerAgent: 3,
    overageRate: 0.003,
    messagingEnabled: true,
  },
  double_0: {
    label: 'DOUBLE-0',
    price: 79,
    callsLimit: 50_000,
    dailyAllowance: 1_667,
    dailyCeiling: 3_334,
    burstPerMinute: 100,
    burstPerHour: 2_000,
    concurrentPerAgent: 10,
    overageRate: 0.002,
    messagingEnabled: true,
  },
  shadow: {
    label: 'SHADOW',
    price: 249,
    callsLimit: 500_000,
    dailyAllowance: 16_667,
    dailyCeiling: 33_334,
    burstPerMinute: 500,
    burstPerHour: 10_000,
    concurrentPerAgent: 25,
    overageRate: 0.001,
    messagingEnabled: true,
  },
} as const;

export type PlanId = keyof typeof PLANS;

export const PLAN_IDS = Object.keys(PLANS) as PlanId[];

/** Map old plan names to new ones for backward compatibility */
export const LEGACY_PLAN_MAP: Record<string, PlanId> = {
  explorer: 'recruit',
  builder: 'field_agent',
  scale: 'double_0',
};

/** Resolve a plan ID, handling legacy names */
export function resolvePlan(plan: string): PlanId {
  return (LEGACY_PLAN_MAP[plan] ?? plan) as PlanId;
}

export function getPlanConfig(plan: string) {
  const resolved = resolvePlan(plan);
  return PLANS[resolved] ?? PLANS.recruit;
}
```

- [ ] **Step 2: Update subscriber registration to use centralised config**

In `src/app/api/subscribers/register/route.ts`, replace lines 6-10:

```typescript
import { getPlanConfig, PLAN_IDS } from '@/lib/plans';
```

Replace `PLAN_LIMITS[plan]` usage with `getPlanConfig(plan).callsLimit`.

- [ ] **Step 3: Update Stripe webhook to use centralised config**

In `src/app/api/stripe/webhook/route.ts`, replace lines 5-8 `PLAN_MAP` with:

```typescript
import { getPlanConfig } from '@/lib/plans';
```

Replace `PLAN_MAP[planKey]` lookups with `getPlanConfig(planKey)`. Update the checkout.session.completed handler to read the plan from metadata and use `getPlanConfig()` for callsLimit.

- [ ] **Step 4: Update Google auth route**

In `src/app/api/auth/google/route.ts`, replace the hardcoded `callsLimit: 500` (line 85) with:

```typescript
import { getPlanConfig } from '@/lib/plans';
// ...
callsLimit: getPlanConfig('recruit').callsLimit,
callsBalance: getPlanConfig('recruit').callsLimit,
dailyAllowance: getPlanConfig('recruit').dailyAllowance,
dailyCeiling: getPlanConfig('recruit').dailyCeiling,
```

- [ ] **Step 5: Update validation schemas**

In `src/lib/validation.ts`, update any plan validation to accept new plan IDs:

```typescript
import { PLAN_IDS } from '@/lib/plans';
// Use PLAN_IDS for plan enum validation
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/plans.ts src/app/api/subscribers/register/route.ts src/app/api/stripe/webhook/route.ts src/app/api/auth/google/route.ts src/lib/validation.ts
git commit -m "feat: centralise plan config, update all references to new tiers"
```

---

### Task 3: Wire Sonner Toaster Into Root Layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Import and add Toaster to layout**

In `src/app/layout.tsx`, add the Toaster component. Import it and place it inside the body, after the main content:

```typescript
import { Toaster } from "@/components/ui/sonner";
```

Add `<Toaster />` as the last child inside the body element, after the existing content.

- [ ] **Step 2: Verify toasts work**

Start dev server: `npm run dev`

Open browser console and run: `window.__sonner_test = true` — then trigger a toast from any component to verify it renders.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: wire Sonner toast system into root layout"
```

---

## Phase 2: Pricing & UI Updates

Tasks 4-6 can run in parallel.

### Task 4: Update PricingCards Component

**Files:**
- Modify: `src/components/PricingCards.tsx`

- [ ] **Step 1: Update plan definitions**

In `src/components/PricingCards.tsx`, replace the plans array (lines 20-71) with the new 4-tier structure:

```typescript
import { PLANS } from '@/lib/plans';

const plans = [
  {
    code: 'RCT',
    name: 'RECRUIT',
    plan: 'recruit',
    price: 'Free',
    period: '',
    calls: '500 / mo',
    features: [
      'Access any agent',
      'Standard latency',
      'API access only',
      'Community support',
    ],
    popular: false,
  },
  {
    code: 'FA',
    name: 'FIELD AGENT',
    plan: 'field_agent',
    price: '$19',
    period: '/ mo',
    calls: '5,000 / mo',
    features: [
      'API + Telegram access',
      'Priority latency',
      'Webhooks & analytics',
      'Overage: $0.003/call',
    ],
    popular: true,
  },
  {
    code: '00',
    name: 'DOUBLE-0',
    plan: 'double_0',
    price: '$79',
    period: '/ mo',
    calls: '50,000 / mo',
    features: [
      'API + Telegram access',
      'Lowest latency',
      'Advanced analytics',
      'Overage: $0.002/call',
      'Early access to new agents',
    ],
    popular: false,
  },
  {
    code: 'SH',
    name: 'SHADOW',
    plan: 'shadow',
    price: '$249',
    period: '/ mo',
    calls: '500,000 / mo',
    features: [
      'All channels + priority routing',
      'Lowest latency',
      'Full analytics suite',
      'Overage: $0.001/call',
      'Priority support',
      'Enterprise features',
    ],
    popular: false,
  },
];
```

- [ ] **Step 2: Update PLAN_ORDER and checkout logic**

Update `PLAN_ORDER` to: `['recruit', 'field_agent', 'double_0', 'shadow']`

Update `handleSelect()` to handle the new plan names and map them to Stripe price IDs. The Stripe checkout call sends the plan name in metadata — the webhook resolves it.

- [ ] **Step 3: Test pricing page renders**

Run: `npm run dev`
Navigate to `/pricing` and verify all 4 tiers render correctly with new prices and features.

- [ ] **Step 4: Commit**

```bash
git add src/components/PricingCards.tsx
git commit -m "feat: update pricing cards to 4-tier model (Recruit/FA/D0/Shadow)"
```

---

### Task 5: Remove pricePerCall From Provider Dashboard

**Files:**
- Modify: `src/app/provider/dashboard/ProviderDashboardClient.tsx`
- Modify: `src/app/api/provider/agents/route.ts`

- [ ] **Step 1: Remove pricePerCall from EditForm**

In `src/app/provider/dashboard/ProviderDashboardClient.tsx`:

1. Remove `pricePerCall` from the AgentData interface (line 39)
2. Remove `setPricePerCall` state (line 216)
3. Remove `pricePerCall` from the save body (line 236)
4. Remove the entire "PRICE PER CALL (CENTS)" input field (lines 295-307)
5. Remove the per-call price display in agent cards (lines 730-734) — replace with platform pricing note

- [ ] **Step 2: Remove pricePerCall from PATCH handler**

In `src/app/api/agents/route.ts` (the PATCH handler), remove `pricePerCall` from the accepted update fields. If it's passed, ignore it.

- [ ] **Step 3: Test provider dashboard**

Navigate to `/provider/dashboard`, verify the edit form no longer shows price per call, and saving still works.

- [ ] **Step 4: Commit**

```bash
git add src/app/provider/dashboard/ProviderDashboardClient.tsx src/app/api/provider/agents/route.ts src/app/api/agents/route.ts
git commit -m "fix: remove provider-editable pricePerCall — platform-set pricing only"
```

---

### Task 6: Update Dashboard Plan Labels & Stats

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`
- Modify: `src/app/api/dashboard/stats/route.ts`

- [ ] **Step 1: Update dashboard stats to include rolling replenishment data**

In `src/app/api/dashboard/stats/route.ts`, add `callsBalance`, `dailyAllowance`, `dailyCeiling`, and `lastReplenishAt` to the response:

```typescript
return NextResponse.json({
  plan: user.plan,
  planLabel: getPlanConfig(user.plan).label,
  callsUsed: user.callsUsed,
  callsLimit: user.callsLimit,
  callsBalance: user.callsBalance,
  dailyAllowance: user.dailyAllowance,
  dailyCeiling: user.dailyCeiling,
  callsRemaining,
  percentUsed,
  recentCalls: formattedCalls,
});
```

- [ ] **Step 2: Update DashboardClient to show new plan names and balance**

In `src/app/dashboard/DashboardClient.tsx`, update plan label display to use `planLabel` from the API (RECRUIT, FIELD AGENT, DOUBLE-0, SHADOW instead of explorer, builder, scale).

Add balance display:
```
FIELD AGENT — $19/mo
├── Balance:            4,847 calls available
├── Daily replenishment: +167 calls/day
├── Total used:         153 / 5,000
└── Renews: May 13, 2026
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx src/app/api/dashboard/stats/route.ts
git commit -m "feat: update dashboard with new plan labels and balance display"
```

---

## Phase 3: Provider Registration & Level 2 Validation

### Task 7: Level 2 Endpoint Validation

**Files:**
- Create: `src/lib/agent-validation.ts`
- Modify: `src/app/api/agents/route.ts` (POST handler)

- [ ] **Step 1: Create agent endpoint validation module**

Create `src/lib/agent-validation.ts`:

```typescript
import { validateEndpointUrl } from './security';

interface ValidationResult {
  valid: boolean;
  healthOk: boolean;
  tasksOk: boolean;
  skillsOk: boolean;
  agentCardFound: boolean;
  agentCard: Record<string, unknown> | null;
  skills: Array<{ id: string; name: string; description: string }>;
  latencyMs: number;
  errors: string[];
}

export async function validateAgentEndpoints(endpointUrl: string): Promise<ValidationResult> {
  const errors: string[] = [];
  let healthOk = false;
  let tasksOk = false;
  let skillsOk = false;
  let agentCardFound = false;
  let agentCard: Record<string, unknown> | null = null;
  let skills: Array<{ id: string; name: string; description: string }> = [];
  let latencyMs = 0;

  // Validate URL safety (SSRF)
  const urlCheck = validateEndpointUrl(endpointUrl);
  if (!urlCheck.safe) {
    return { valid: false, healthOk, tasksOk, skillsOk, agentCardFound, agentCard, skills, latencyMs, errors: [urlCheck.reason ?? 'Invalid endpoint URL'] };
  }

  const baseUrl = endpointUrl.replace(/\/+$/, '');

  // 1. Health check
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const start = Date.now();
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    latencyMs = Date.now() - start;
    clearTimeout(timeout);

    if (res.ok) {
      const body = await res.json();
      if (body.status === 'ok') {
        healthOk = true;
      } else {
        errors.push('Health endpoint must return {"status": "ok"}');
      }
    } else {
      errors.push(`Health endpoint returned ${res.status}`);
    }
  } catch (e) {
    errors.push(`Health endpoint unreachable: ${e instanceof Error ? e.message : 'timeout'}`);
  }

  // 2. POST /tasks test
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: 'health_check', context: null, session_id: null }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (res.ok) {
      const body = await res.json();
      if (body.status && body.output !== undefined) {
        tasksOk = true;
      } else {
        errors.push('POST /tasks must return {status, output} fields');
      }
    } else if (res.status === 422) {
      // 422 is acceptable — means it validates input properly
      tasksOk = true;
    } else {
      errors.push(`POST /tasks returned ${res.status}`);
    }
  } catch (e) {
    errors.push(`POST /tasks failed: ${e instanceof Error ? e.message : 'timeout'}`);
  }

  // 3. GET /skills
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${baseUrl}/skills`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const body = await res.json();
      if (Array.isArray(body.skills)) {
        skills = body.skills;
        skillsOk = true;
      } else {
        errors.push('GET /skills must return {skills: [...]}');
      }
    } else {
      errors.push(`GET /skills returned ${res.status}`);
    }
  } catch (e) {
    errors.push(`GET /skills failed: ${e instanceof Error ? e.message : 'timeout'}`);
  }

  // 4. Agent card (optional — Level 3)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${baseUrl}/.well-known/agent-card.json`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const body = await res.json();
      if (body.name && body.description) {
        agentCardFound = true;
        agentCard = body;
      }
    }
    // Not an error if missing — Level 3 is optional
  } catch {
    // Silently ignore — optional endpoint
  }

  const valid = healthOk && tasksOk && skillsOk;
  return { valid, healthOk, tasksOk, skillsOk, agentCardFound, agentCard, skills, latencyMs, errors };
}
```

- [ ] **Step 2: Integrate validation into POST /api/agents**

In `src/app/api/agents/route.ts`, update the POST handler to call `validateAgentEndpoints()` before creating the agent. If validation fails, return 422 with the specific errors. If agent card is found, set `hasAgentCard: true` and store skills in `skillsData`.

- [ ] **Step 3: Add unique name check to POST handler**

Before creating the agent, check for existing agent with same name:

```typescript
const existingName = await prisma.agent.findFirst({ where: { name } });
if (existingName) {
  return NextResponse.json(
    { error: 'An agent with this name already exists. Choose a unique name.' },
    { status: 409 }
  );
}
```

- [ ] **Step 4: Test with mock agent**

The existing mock agent at `/api/mock/agent` serves GET and POST. Test registration by pointing to it.

Run: `npm run dev`
Use curl or the registration UI to register an agent pointing to `http://localhost:3000/api/mock/agent`. It should fail validation (mock doesn't have /skills or /health in the right format) — this confirms the validation is running.

- [ ] **Step 5: Commit**

```bash
git add src/lib/agent-validation.ts src/app/api/agents/route.ts
git commit -m "feat: Level 2 endpoint validation for agent registration (health, tasks, skills)"
```

---

### Task 8: Generated Agent Cards API

**Files:**
- Create: `src/app/api/agents/[slug]/card.json/route.ts`

- [ ] **Step 1: Create agent card endpoint**

Create `src/app/api/agents/[slug]/card.json/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const agent = await prisma.agent.findUnique({
    where: { slug },
    include: { provider: { select: { name: true, email: true } } },
  });

  if (!agent || agent.status === 'suspended') {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const skills = (agent.skillsData as Array<{ id: string; name: string; description: string }>) ?? [
    { id: 'default', name: agent.name, description: agent.shortDesc || agent.description.slice(0, 200) },
  ];

  const card = {
    name: agent.name,
    description: agent.description,
    version: '1.0.0',
    url: agent.endpointUrl,
    provider: {
      organization: agent.provider.name,
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      multiTurn: false,
    },
    skills: skills.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
    })),
    authentication: {
      schemes: agent.authType === 'none' ? [] : [agent.authType],
    },
    protocolVersion: '0.2.1',
    platformUrl: `https://houseofagents.com/agents/${agent.slug}`,
    badges: agent.hasAgentCard ? ['a2a-compatible'] : [],
  };

  return NextResponse.json(card, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
```

- [ ] **Step 2: Test endpoint**

Run: `npm run dev`
Curl: `curl http://localhost:3000/api/agents/documind/card.json` (use an existing agent slug from seed data)
Expected: JSON agent card with name, description, skills, etc.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/agents/[slug]/card.json/route.ts
git commit -m "feat: generated A2A agent cards for all registered agents"
```

---

## Phase 4: Usage Governance

### Task 9: Rolling Daily Replenishment Cron

**Files:**
- Modify: `src/lib/orchestrator.ts`
- Create: `src/lib/usage.ts`

- [ ] **Step 1: Create usage governance module**

Create `src/lib/usage.ts`:

```typescript
import { prisma } from './prisma';
import { getPlanConfig } from './plans';

/**
 * Daily replenishment: add dailyAllowance to callsBalance, capped at callsLimit.
 * Runs once per day via orchestrator.
 */
export async function dailyReplenishment() {
  const users = await prisma.user.findMany({
    where: {
      plan: { not: 'recruit' }, // Recruit is hard-capped, no rolling
    },
    select: { id: true, plan: true, callsBalance: true, callsLimit: true, dailyAllowance: true },
  });

  let replenished = 0;
  for (const user of users) {
    const config = getPlanConfig(user.plan);
    const newBalance = Math.min(user.callsBalance + config.dailyAllowance, config.callsLimit);

    if (newBalance !== user.callsBalance) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          callsBalance: newBalance,
          lastReplenishAt: new Date(),
        },
      });
      replenished++;
    }
  }

  return { replenished, total: users.length };
}
```

- [ ] **Step 2: Add daily replenishment job to orchestrator**

In `src/lib/orchestrator.ts`, add a new cron job:

```typescript
import { dailyReplenishment } from './usage';

// Add to startOrchestrator():
cron.schedule('0 0 * * *', async () => {
  // Daily at midnight
  console.log('[orchestrator] Starting daily replenishment...');
  try {
    const result = await dailyReplenishment();
    console.log(`[orchestrator] Daily replenishment complete: ${result.replenished}/${result.total} users topped up`);
  } catch (err) {
    console.error('[orchestrator] Daily replenishment failed:', err);
  }
});
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/usage.ts src/lib/orchestrator.ts
git commit -m "feat: rolling daily replenishment cron for usage governance"
```

---

### Task 10: Burst Protection (Redis Rate Limiting)

**Files:**
- Create: `src/lib/rate-limit.ts`
- Modify: `src/app/api/v1/run/route.ts`

- [ ] **Step 1: Create Redis-based burst rate limiter**

Create `src/lib/rate-limit.ts`:

```typescript
import { getRedis } from './redis';
import { getPlanConfig } from './plans';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter?: number;
}

/**
 * Per-minute burst rate limit using Redis INCR + EXPIRE.
 */
export async function checkBurstLimit(userId: string, plan: string): Promise<RateLimitResult> {
  const redis = getRedis();
  if (!redis) {
    // Redis unavailable — fail open (allow request)
    return { allowed: true, remaining: 999, limit: 999 };
  }

  const config = getPlanConfig(plan);
  const minute = Math.floor(Date.now() / 60000);
  const key = `burst:${userId}:${minute}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, 120); // TTL > 1 minute for safety
  }

  if (current > config.burstPerMinute) {
    const retryAfter = 60 - (Math.floor(Date.now() / 1000) % 60);
    return {
      allowed: false,
      remaining: 0,
      limit: config.burstPerMinute,
      retryAfter,
    };
  }

  return {
    allowed: true,
    remaining: config.burstPerMinute - current,
    limit: config.burstPerMinute,
  };
}

/**
 * Per-agent concurrency limit.
 */
export async function checkConcurrency(userId: string, agentId: string, plan: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;

  const config = getPlanConfig(plan);
  const key = `concurrent:${userId}:${agentId}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, 60); // Auto-cleanup after 60s
  }

  if (current > config.concurrentPerAgent) {
    await redis.decr(key);
    return false;
  }

  return true;
}

export async function releaseConcurrency(userId: string, agentId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const key = `concurrent:${userId}:${agentId}`;
  await redis.decr(key);
}
```

- [ ] **Step 2: Integrate burst limiting into /api/v1/run**

In `src/app/api/v1/run/route.ts`, add burst check after auth but before the agent call:

```typescript
import { checkBurstLimit, checkConcurrency, releaseConcurrency } from '@/lib/rate-limit';

// After auth check, before agent proxy:
const burstCheck = await checkBurstLimit(subscriber.id, subscriber.plan);
if (!burstCheck.allowed) {
  return NextResponse.json(
    { error: 'Rate limit exceeded', retryAfter: burstCheck.retryAfter },
    { status: 429, headers: { 'Retry-After': String(burstCheck.retryAfter) } }
  );
}
```

Also update the existing `callsUsed` atomic increment to use `callsBalance` instead (decrement balance):

```typescript
const rateCheck = await prisma.user.updateMany({
  where: { id: subscriber.id, callsBalance: { gt: 0 } },
  data: { callsBalance: { decrement: 1 }, callsUsed: { increment: 1 } },
});
```

- [ ] **Step 3: Update response headers**

Replace existing rate limit headers with:

```typescript
const rateLimitHeaders: Record<string, string> = {
  'X-RateLimit-Limit': String(subscriber.callsLimit),
  'X-RateLimit-Remaining': String(Math.max(0, subscriber.callsBalance - 1)),
  'X-RateLimit-Daily-Remaining': String(subscriber.dailyCeiling),
  'X-Burst-Limit': `${burstCheck.limit}/min`,
  'X-Burst-Remaining': String(burstCheck.remaining),
};
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/rate-limit.ts src/app/api/v1/run/route.ts
git commit -m "feat: Redis burst protection and balance-based rate limiting"
```

---

## Phase 5: Notification System

### Task 11: Toast Notifications on Key Events

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`
- Modify: `src/app/provider/dashboard/ProviderDashboardClient.tsx`
- Modify: `src/components/PricingCards.tsx`

- [ ] **Step 1: Add usage toasts to dashboard**

In `src/app/dashboard/DashboardClient.tsx`, import `toast` from `sonner` and add threshold notifications when stats load:

```typescript
import { toast } from 'sonner';

// After fetching stats:
useEffect(() => {
  if (!stats) return;
  const pct = (stats.callsUsed / stats.callsLimit) * 100;

  if (pct >= 95) {
    toast.warning('Almost at your limit — consider upgrading.', {
      description: `${stats.callsLimit - stats.callsUsed} calls remaining.`,
    });
  } else if (pct >= 80) {
    toast.info(`You've used ${Math.round(pct)}% of your monthly calls.`, {
      description: `${stats.callsLimit - stats.callsUsed} calls remaining.`,
    });
  }
}, [stats]);
```

- [ ] **Step 2: Add provider toasts**

In `src/app/provider/dashboard/ProviderDashboardClient.tsx`, add toasts for save success/failure:

```typescript
import { toast } from 'sonner';

// On save success:
toast.success('Agent updated successfully.');

// On save error:
toast.error('Failed to save changes.', { description: error });

// On screening pass (when agent status changes to 'active'):
toast.success('Your agent passed screening and is now live on the marketplace.');
```

- [ ] **Step 3: Add pricing toasts**

In `src/components/PricingCards.tsx`, add toast on successful checkout redirect:

```typescript
import { toast } from 'sonner';

// On checkout creation:
toast.info('Redirecting to checkout...');

// On downgrade attempt:
toast.warning('Manage your plan via the billing portal.');
```

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx src/app/provider/dashboard/ProviderDashboardClient.tsx src/components/PricingCards.tsx
git commit -m "feat: toast notifications for usage thresholds, provider actions, and checkout"
```

---

## Phase 6: Search & CORS

### Task 12: CORS Production Lockdown

**Files:**
- Modify: `src/middleware.ts`

- [ ] **Step 1: Restrict CORS in production**

The current middleware already checks origin against `NEXT_PUBLIC_APP_URL` (lines 15-24). Verify it rejects requests from unknown origins in production. If the origin check allows all origins when `NEXT_PUBLIC_APP_URL` is not set, add a fallback:

```typescript
// Only allow same-origin in production if NEXT_PUBLIC_APP_URL is not configured
const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || (process.env.NODE_ENV === 'production' ? null : origin);
```

If `allowedOrigin` is null in production, don't set `Access-Control-Allow-Origin` header (blocks cross-origin requests).

- [ ] **Step 2: Commit**

```bash
git add src/middleware.ts
git commit -m "fix: restrict CORS to configured origins in production"
```

---

### Task 13: Postgres Full-Text Search

**Files:**
- Modify: `src/app/api/agents/route.ts`
- Create: `prisma/migrations/XXXXXX_add_search_vector/migration.sql` (manual migration)

- [ ] **Step 1: Add search vector via raw SQL migration**

Create a manual migration for Postgres full-text search:

```bash
npx prisma migrate dev --create-only --name add-search-vector
```

Edit the generated migration SQL to add:

```sql
-- Add tsvector column
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Populate it from existing data
UPDATE "Agent" SET "searchVector" =
  setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
  setweight(to_tsvector('english', coalesce("shortDesc", '')), 'B') ||
  setweight(to_tsvector('english', coalesce("description", '')), 'C') ||
  setweight(to_tsvector('english', coalesce(array_to_string("tags", ' '), '')), 'B');

-- Create GIN index
CREATE INDEX IF NOT EXISTS "Agent_searchVector_idx" ON "Agent" USING GIN ("searchVector");

-- Create trigger to auto-update on INSERT/UPDATE
CREATE OR REPLACE FUNCTION agent_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."shortDesc", '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW."description", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW."tags", ' '), '')), 'B');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agent_search_update ON "Agent";
CREATE TRIGGER agent_search_update
  BEFORE INSERT OR UPDATE OF "name", "shortDesc", "description", "tags"
  ON "Agent"
  FOR EACH ROW
  EXECUTE FUNCTION agent_search_vector_update();
```

- [ ] **Step 2: Apply migration**

Run: `npx prisma migrate dev`

- [ ] **Step 3: Update search in GET /api/agents**

In `src/app/api/agents/route.ts`, replace the `contains`-based search (lines 28-33) with Postgres full-text search using raw query:

```typescript
if (q) {
  // Use Postgres full-text search for better results
  const tsQuery = q.split(/\s+/).filter(Boolean).join(' & ');
  where.searchVector = {
    search: tsQuery,
  };
  // Prisma doesn't natively support ts_rank, so we fall back to
  // basic tsvector @@ for now. For ranking, we keep the existing sort.
}
```

Note: Prisma 7 may have full-text search support via `@fulltext` — check `node_modules/next/dist/docs/` and Prisma docs. If not, use `$queryRaw` for the ranked query.

- [ ] **Step 4: Test search**

Test: `curl "http://localhost:3000/api/agents?q=contract+analysis"`
Expected: Returns agents matching "contract" OR "analysis" in name/description/tags, even if the exact string isn't present.

- [ ] **Step 5: Commit**

```bash
git add prisma/migrations/ src/app/api/agents/route.ts
git commit -m "feat: Postgres full-text search with tsvector, GIN index, and auto-update trigger"
```

---

## Phase 7: Telegram Bot

### Task 14: Telegram Bot — Webhook & Gateway

**Files:**
- Create: `src/app/api/messaging/telegram/route.ts`
- Create: `src/app/api/messaging/link/route.ts`
- Create: `src/lib/messaging/gateway.ts`
- Create: `src/lib/messaging/telegram.ts`
- Create: `src/lib/messaging/classifier.ts`
- Create: `src/lib/messaging/sessions.ts`

- [ ] **Step 1: Create Telegram API adapter**

Create `src/lib/messaging/telegram.ts`:

```typescript
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; first_name: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
  callback_query?: {
    id: string;
    from: { id: number; first_name: string };
    message: { chat: { id: number }; message_id: number };
    data: string;
  };
}

export async function sendMessage(chatId: number, text: string, replyMarkup?: unknown) {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  };
  if (replyMarkup) body.reply_markup = replyMarkup;

  await fetch(`${API_BASE}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function answerCallbackQuery(callbackQueryId: string) {
  await fetch(`${API_BASE}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackQueryId }),
  });
}

export function inlineKeyboard(buttons: Array<Array<{ text: string; callback_data: string }>>) {
  return { inline_keyboard: buttons };
}
```

- [ ] **Step 2: Create session manager**

Create `src/lib/messaging/sessions.ts`:

```typescript
import { getRedis } from '../redis';

export interface AgentSession {
  agentSlug: string;
  agentId: string;
  agentName: string;
  turnCount: number;
  startedAt: number;
  history: Array<{ role: 'user' | 'agent'; content: string }>;
}

const SESSION_TTL = 1800; // 30 minutes

export async function getSession(userId: string, platform: string): Promise<AgentSession | null> {
  const redis = getRedis();
  if (!redis) return null;
  const data = await redis.get(`session:${userId}:${platform}`);
  return data ? JSON.parse(data) : null;
}

export async function setSession(userId: string, platform: string, session: AgentSession): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.set(`session:${userId}:${platform}`, JSON.stringify(session), 'EX', SESSION_TTL);
}

export async function deleteSession(userId: string, platform: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(`session:${userId}:${platform}`);
}

export function getSessionWeight(turnCount: number): number {
  if (turnCount <= 3) return 1;
  if (turnCount <= 7) return 2;
  if (turnCount <= 15) return 3;
  return 5;
}
```

- [ ] **Step 3: Create Haiku classifier**

Create `src/lib/messaging/classifier.ts`:

```typescript
import Anthropic from '@anthropic-ai/sdk';

// Note: requires @anthropic-ai/sdk — add to package.json if not present
// For now, use fetch directly to the Claude API

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are a routing classifier for House of Agents.
Given a user message, return JSON only:
{"category":"<one of: document-analysis, sales-automation, code-review, legal, creative, customer-support, research, dev-tools>","intent":"<brief description>","confidence":0.0-1.0}
If confidence < 0.7, set category to "unclear".`;

interface Classification {
  category: string;
  intent: string;
  confidence: number;
}

export async function classifyMessage(message: string): Promise<Classification> {
  if (!ANTHROPIC_API_KEY) {
    return { category: 'unclear', intent: 'API key not configured', confidence: 0 };
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: message }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text ?? '';
    return JSON.parse(text) as Classification;
  } catch {
    return { category: 'unclear', intent: 'classification failed', confidence: 0 };
  }
}
```

- [ ] **Step 4: Create message gateway**

Create `src/lib/messaging/gateway.ts`:

```typescript
import { prisma } from '../prisma';
import { classifyMessage } from './classifier';
import { getSession, setSession, deleteSession, getSessionWeight } from './sessions';
import { getPlanConfig } from '../plans';

interface GatewayRequest {
  userId: string;
  platform: string;
  text: string;
}

interface GatewayResponse {
  text: string;
  buttons?: Array<Array<{ text: string; callback_data: string }>>;
}

export async function handleMessage(req: GatewayRequest): Promise<GatewayResponse> {
  const { userId, platform, text } = req;

  // Check plan allows messaging
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { text: 'Account not found. Please re-link at houseofagents.com/link' };

  const config = getPlanConfig(user.plan);
  if (!config.messagingEnabled) {
    return { text: 'Messaging is available on paid plans. Upgrade at houseofagents.com/pricing' };
  }

  // Handle commands
  if (text === '/done' || text === '/switch') {
    await deleteSession(userId, platform);
    if (text === '/done') return { text: 'Session ended. What else can I help with?' };
    // /switch falls through to new classification
  }

  if (text === '/status') {
    const session = await getSession(userId, platform);
    const sessionInfo = session ? `Active session: ${session.agentName} (turn ${session.turnCount})` : 'No active session';
    return { text: `${config.label} plan\nBalance: ${user.callsBalance} calls\n${sessionInfo}` };
  }

  if (text === '/help') {
    return { text: 'Commands:\n/done — end session\n/switch — change agent\n/status — plan & balance\n/agents — browse agents\n/help — this message' };
  }

  // Check for active session
  const session = await getSession(userId, platform);

  if (session) {
    // Forward to agent
    const weight = getSessionWeight(session.turnCount + 1);

    // Check balance
    if (user.callsBalance < weight) {
      return { text: `Not enough calls. This message costs ${weight} calls but you have ${user.callsBalance}. /done to end session.` };
    }

    // Deduct calls
    await prisma.user.update({
      where: { id: userId },
      data: { callsBalance: { decrement: weight }, callsUsed: { increment: weight } },
    });

    // Proxy to agent
    const agent = await prisma.agent.findUnique({ where: { id: session.agentId } });
    if (!agent) {
      await deleteSession(userId, platform);
      return { text: 'Agent no longer available. Session ended.' };
    }

    try {
      const proxyRes = await fetch(`${agent.endpointUrl.replace(/\/+$/, '')}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          context: { history: session.history.slice(-10) },
          session_id: `hoa_sess_${userId}_${platform}`,
        }),
      });

      const result = await proxyRes.json();
      const output = result.output ?? 'No response from agent.';

      // Update session
      session.turnCount++;
      session.history.push({ role: 'user', content: text });
      session.history.push({ role: 'agent', content: output });
      await setSession(userId, platform, session);

      const nextWeight = getSessionWeight(session.turnCount + 1);
      const footer = `\n\n_${session.agentName} · turn ${session.turnCount} · ${nextWeight} call${nextWeight > 1 ? 's' : ''}/msg · ${user.callsBalance - weight} remaining_`;

      return { text: output + footer };
    } catch {
      return { text: 'Agent failed to respond. Try again or /done to end session.' };
    }
  }

  // No active session — classify and recommend
  const classification = await classifyMessage(text);

  if (classification.category === 'unclear' || classification.confidence < 0.7) {
    return {
      text: "I'm not sure which type of agent you need. What are you looking for?",
      buttons: [
        [{ text: 'Document Analysis', callback_data: 'cat:document-analysis' }, { text: 'Legal', callback_data: 'cat:legal' }],
        [{ text: 'Code Review', callback_data: 'cat:code-review' }, { text: 'Creative', callback_data: 'cat:creative' }],
        [{ text: 'Research', callback_data: 'cat:research' }, { text: 'Dev Tools', callback_data: 'cat:dev-tools' }],
        [{ text: 'Support', callback_data: 'cat:customer-support' }, { text: 'Sales', callback_data: 'cat:sales-automation' }],
      ],
    };
  }

  // Find top agent in category
  const topAgent = await prisma.agent.findFirst({
    where: { category: classification.category, status: 'active' },
    orderBy: { currentScore: 'desc' },
  });

  if (!topAgent) {
    return { text: `No agents available in ${classification.category}. Try a different category.` };
  }

  const ratingStr = topAgent.rating ? `★${topAgent.rating.toFixed(1)}` : 'new';

  return {
    text: `I'd recommend *${topAgent.name}* (${ratingStr}) — top-rated in ${classification.category}.`,
    buttons: [
      [
        { text: 'Connect', callback_data: `connect:${topAgent.slug}` },
        { text: 'Show alternatives', callback_data: `alts:${classification.category}` },
        { text: 'Cancel', callback_data: 'cancel' },
      ],
    ],
  };
}

export async function handleCallback(userId: string, platform: string, data: string): Promise<GatewayResponse> {
  if (data === 'cancel') {
    return { text: 'Cancelled. Send me a message when you need help.' };
  }

  if (data.startsWith('connect:')) {
    const slug = data.replace('connect:', '');
    const agent = await prisma.agent.findUnique({ where: { slug } });
    if (!agent) return { text: 'Agent not found.' };

    await setSession(userId, platform, {
      agentSlug: agent.slug,
      agentId: agent.id,
      agentName: agent.name,
      turnCount: 0,
      startedAt: Date.now(),
      history: [],
    });

    return { text: `Connected to *${agent.name}*. Send your message.\n\n_/done to end · /switch to change agent_` };
  }

  if (data.startsWith('alts:')) {
    const category = data.replace('alts:', '');
    const agents = await prisma.agent.findMany({
      where: { category, status: 'active' },
      orderBy: { currentScore: 'desc' },
      take: 3,
    });

    if (agents.length === 0) return { text: 'No agents available in this category.' };

    const list = agents.map((a, i) => `${i + 1}. *${a.name}* (${a.rating ? `★${a.rating.toFixed(1)}` : 'new'}) — ${a.shortDesc || a.description.slice(0, 60)}`).join('\n');

    return {
      text: `Available agents:\n\n${list}`,
      buttons: [agents.map((a, i) => ({ text: `${i + 1}`, callback_data: `connect:${a.slug}` }))],
    };
  }

  if (data.startsWith('cat:')) {
    const category = data.replace('cat:', '');
    // Same as alts flow
    return handleCallback(userId, platform, `alts:${category}`);
  }

  return { text: 'Unknown action.' };
}
```

- [ ] **Step 5: Create account linking endpoint**

Create `src/app/api/messaging/link/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth';
import { getRedis } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const user = await resolveUser(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { code } = await request.json();
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code required' }, { status: 400 });
  }

  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  // Look up code
  const linkData = await redis.get(`link:${code.toUpperCase()}`);
  if (!linkData) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
  }

  const { platform, platformUserId } = JSON.parse(linkData);

  // Create or update messaging link
  await prisma.messagingLink.upsert({
    where: { platform_platformUserId: { platform, platformUserId } },
    create: { platform, platformUserId, userId: user.id },
    update: { userId: user.id },
  });

  // Delete the code
  await redis.del(`link:${code.toUpperCase()}`);

  return NextResponse.json({ linked: true, platform });
}
```

- [ ] **Step 6: Create Telegram webhook handler**

Create `src/app/api/messaging/telegram/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getRedis } from '@/lib/redis';
import { handleMessage, handleCallback } from '@/lib/messaging/gateway';
import { sendMessage, answerCallbackQuery, inlineKeyboard, type TelegramUpdate } from '@/lib/messaging/telegram';
import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  const update: TelegramUpdate = await request.json();

  // Handle callback queries (button presses)
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id;
    const platformUserId = String(cb.from.id);

    await answerCallbackQuery(cb.id);

    const link = await prisma.messagingLink.findUnique({
      where: { platform_platformUserId: { platform: 'telegram', platformUserId } },
    });

    if (!link) {
      await sendMessage(chatId, 'Please link your account first. Send /start');
      return NextResponse.json({ ok: true });
    }

    const response = await handleCallback(link.userId, 'telegram', cb.data);
    await sendMessage(chatId, response.text, response.buttons ? inlineKeyboard(response.buttons) : undefined);
    return NextResponse.json({ ok: true });
  }

  // Handle messages
  if (update.message?.text) {
    const msg = update.message;
    const chatId = msg.chat.id;
    const platformUserId = String(msg.from.id);
    const text = msg.text;

    // /start command — account linking
    if (text === '/start') {
      const redis = getRedis();
      if (!redis) {
        await sendMessage(chatId, 'Service temporarily unavailable. Try again later.');
        return NextResponse.json({ ok: true });
      }

      const code = nanoid(6).toUpperCase();
      await redis.set(`link:${code}`, JSON.stringify({ platform: 'telegram', platformUserId }), 'EX', 600);

      await sendMessage(
        chatId,
        `Welcome to House of Agents.\n\nTo get started, link your account:\n\n1. Go to houseofagents.com/link\n2. Sign in with Google\n3. Enter code: *${code}*\n\nCode expires in 10 minutes.`
      );
      return NextResponse.json({ ok: true });
    }

    // Check if linked
    const link = await prisma.messagingLink.findUnique({
      where: { platform_platformUserId: { platform: 'telegram', platformUserId } },
    });

    if (!link) {
      await sendMessage(chatId, 'Please link your account first. Send /start');
      return NextResponse.json({ ok: true });
    }

    // Route through gateway
    const response = await handleMessage({ userId: link.userId, platform: 'telegram', text });
    await sendMessage(chatId, response.text, response.buttons ? inlineKeyboard(response.buttons) : undefined);
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Commit**

```bash
git add src/lib/messaging/ src/app/api/messaging/
git commit -m "feat: Telegram bot with Haiku routing, session management, and account linking"
```

---

## Phase 8: Compliance & Documentation

Tasks 15-17 can run in parallel.

### Task 15: Data Deletion Endpoint

**Files:**
- Create: `src/app/api/account/delete/route.ts`

- [ ] **Step 1: Create account deletion endpoint**

Create `src/app/api/account/delete/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest) {
  const user = await resolveUser(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Delete in order (respecting foreign keys)
  await prisma.$transaction([
    prisma.apiCall.deleteMany({ where: { subscriberId: user.id } }),
    prisma.review.deleteMany({ where: { userId: user.id } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
    prisma.messagingLink.deleteMany({ where: { userId: user.id } }),
    // If provider: delete their agents and related data
    prisma.healthCheck.deleteMany({ where: { agent: { providerId: user.id } } }),
    prisma.benchmark.deleteMany({ where: { agent: { providerId: user.id } } }),
    prisma.apiCall.deleteMany({ where: { agent: { providerId: user.id } } }),
    prisma.agent.deleteMany({ where: { providerId: user.id } }),
    prisma.user.delete({ where: { id: user.id } }),
  ]);

  return NextResponse.json({ deleted: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/account/delete/route.ts
git commit -m "feat: GDPR account deletion endpoint"
```

---

### Task 16: Update Docs Page With New Tiers

**Files:**
- Modify: `src/app/docs/page.tsx`

- [ ] **Step 1: Update rate limits table**

In `src/app/docs/page.tsx`, update the rate limits section (lines 553-634) to reflect new tiers:

| Plan | Requests/Min | Monthly Calls | Concurrent/Agent |
|------|-------------|---------------|------------------|
| Recruit | 5 | 500 | 1 |
| Field Agent | 30 | 5,000 | 3 |
| Double-0 | 100 | 50,000 | 10 |
| Shadow | 500 | 500,000 | 25 |

- [ ] **Step 2: Update API endpoint documentation**

Update the endpoints section to reflect the Level 2 contract. Add documentation for:
- `GET /api/agents/{slug}/card.json` — A2A agent card
- Required provider endpoints: `GET /health`, `POST /tasks`, `GET /skills`

- [ ] **Step 3: Commit**

```bash
git add src/app/docs/page.tsx
git commit -m "docs: update API docs with new tiers and Level 2 contract"
```

---

### Task 17: Cookie Consent Banner

**Files:**
- Create: `src/components/CookieConsent.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create cookie consent component**

Create `src/components/CookieConsent.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('hoa_consent');
    if (!consent) setShow(true);
  }, []);

  if (!show) return null;

  const accept = () => {
    localStorage.setItem('hoa_consent', 'accepted');
    setShow(false);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 p-4">
      <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-4 text-sm text-zinc-400">
        <p className="flex-1">
          We use local storage to save your API key and preferences.
          See our{' '}
          <a href="/privacy" className="text-emerald-400 underline">Privacy Policy</a>.
        </p>
        <button
          onClick={accept}
          className="px-4 py-2 bg-emerald-600 text-white text-xs tracking-wider uppercase rounded hover:bg-emerald-500 transition-colors"
        >
          Accept
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to layout**

In `src/app/layout.tsx`, import and add `<CookieConsent />` before the `<Toaster />`.

- [ ] **Step 3: Commit**

```bash
git add src/components/CookieConsent.tsx src/app/layout.tsx
git commit -m "feat: cookie/storage consent banner for compliance"
```

---

## Phase 9: Integration & Polish

### Task 18: Update RegisterFlow for Level 2 Validation

**Files:**
- Modify: `src/components/RegisterFlow.tsx`

- [ ] **Step 1: Update registration flow UI**

The existing `RegisterFlow.tsx` is the provider agent registration wizard. Update it to:

1. **Step 1 (Connect):** After entering the endpoint URL, call a new validation endpoint that runs `validateAgentEndpoints()` and shows results:
   - Green check for health, tasks, skills
   - Gold badge icon if agent card detected
   - Error messages for failed checks
   - Toast on success: "Agent endpoint verified. Health: OK. Response time: 240ms."

2. **Step 2 (Configure):** Remove `pricePerCall` field. Add real-time name uniqueness check (debounced fetch to `/api/agents?q=exactName`).

3. **Step 3 (Deposit):** Show deposit info but button reads "Your first agent is free" (no Stripe call).

4. **Step 4 (Screening):** Show "Evaluating your agent..." with progress animation. Poll agent status until it changes from `pending` to `active` or gets feedback.

- [ ] **Step 2: Create validation API endpoint**

Create `src/app/api/agents/validate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth';
import { validateAgentEndpoints } from '@/lib/agent-validation';

export async function POST(request: NextRequest) {
  const user = await resolveUser(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { endpointUrl } = await request.json();
  if (!endpointUrl) {
    return NextResponse.json({ error: 'endpointUrl required' }, { status: 400 });
  }

  const result = await validateAgentEndpoints(endpointUrl);
  return NextResponse.json(result);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RegisterFlow.tsx src/app/api/agents/validate/route.ts
git commit -m "feat: Level 2 validation UI in registration flow with real-time feedback"
```

---

### Task 19: Stripe Product Updates

**Files:**
- Modify: `src/app/api/stripe/webhook/route.ts`
- Modify: `src/app/api/stripe/checkout/route.ts`

- [ ] **Step 1: Add new Stripe env vars**

Add to `.env.example` and Railway:
```
STRIPE_FIELD_AGENT_PRICE_ID=
STRIPE_DOUBLE_0_PRICE_ID=
STRIPE_SHADOW_PRICE_ID=
```

- [ ] **Step 2: Update checkout route**

In `src/app/api/stripe/checkout/route.ts`, update the `priceMap`:

```typescript
const priceMap: Record<string, string | undefined> = {
  field_agent: process.env.STRIPE_FIELD_AGENT_PRICE_ID,
  double_0: process.env.STRIPE_DOUBLE_0_PRICE_ID,
  shadow: process.env.STRIPE_SHADOW_PRICE_ID,
};
```

- [ ] **Step 3: Update webhook route**

In `src/app/api/stripe/webhook/route.ts`, update `PLAN_MAP` to use the new plan config:

```typescript
import { getPlanConfig, type PlanId } from '@/lib/plans';

// In checkout.session.completed handler:
const plan = session.metadata?.plan as PlanId;
const config = getPlanConfig(plan);
await prisma.user.update({
  where: { id: userId },
  data: {
    plan,
    callsLimit: config.callsLimit,
    callsBalance: config.callsLimit,
    dailyAllowance: config.dailyAllowance,
    dailyCeiling: config.dailyCeiling,
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/stripe/checkout/route.ts src/app/api/stripe/webhook/route.ts .env.example
git commit -m "feat: update Stripe integration for new pricing tiers"
```

---

### Task 20: Final Integration Test & Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run build**

Run: `npm run build`
Expected: Build succeeds with no TypeScript errors.

- [ ] **Step 2: Test critical paths**

Start dev server: `npm run dev`

Test each path:
1. Homepage loads
2. `/pricing` shows 4 tiers
3. `/docs` shows updated rate limits
4. `/provider/dashboard` edit form has no pricePerCall field
5. `/dashboard` shows new plan labels
6. `POST /api/agents/validate` with mock endpoint
7. `GET /api/agents/documind/card.json` returns agent card
8. Cookie consent banner appears on first visit
9. Privacy and Terms pages load

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: integration fixes from V1 launch verification"
```

- [ ] **Step 4: Push to remote**

```bash
git push
```

---

## Dependency Graph

```
Phase 1 (Schema)
  └── Task 1: Prisma schema ──→ ALL other tasks depend on this
  └── Task 2: Plan constants ──→ Tasks 4, 6, 9, 10, 14, 19
  └── Task 3: Sonner wiring ──→ Task 11

Phase 2 (Pricing) — parallel after Phase 1
  ├── Task 4: PricingCards
  ├── Task 5: Remove pricePerCall
  └── Task 6: Dashboard labels

Phase 3 (Provider) — parallel after Phase 1
  ├── Task 7: Level 2 validation
  └── Task 8: Agent cards API

Phase 4 (Usage) — parallel after Phase 1
  ├── Task 9: Rolling replenishment
  └── Task 10: Burst protection

Phase 5 (Toasts) — after Phase 1 + Task 3
  └── Task 11: Toast notifications

Phase 6 (Search/CORS) — parallel after Phase 1
  ├── Task 12: CORS lockdown
  └── Task 13: Full-text search

Phase 7 (Telegram) — after Phases 1 + 4
  └── Task 14: Telegram bot (largest task)

Phase 8 (Compliance) — parallel, minimal dependencies
  ├── Task 15: Data deletion
  ├── Task 16: Docs update
  └── Task 17: Cookie consent

Phase 9 (Integration) — after all above
  ├── Task 18: RegisterFlow update
  ├── Task 19: Stripe products
  └── Task 20: Final verification
```

## Parallel Execution Guide

**Wave 1 (sequential):** Tasks 1, 2, 3
**Wave 2 (parallel):** Tasks 4, 5, 6, 7, 8, 9, 10, 12, 13, 15, 16, 17
**Wave 3 (parallel):** Tasks 11, 14
**Wave 4 (sequential):** Tasks 18, 19, 20
