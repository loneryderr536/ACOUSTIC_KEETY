# Honesty Pass + Brand Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rip the false claims, stale branding, and gameable economics out of the site so it matches what actually ships. Ship-ready today.

**Architecture:** Pure cleanup pass over existing code. No new subsystems, no schema changes, no Stripe rework. Bump one constant, rename one string prefix, rewrite marketing copy, add a QR component.

**Tech Stack:** Next.js 15 app router (see AGENTS.md — APIs differ from training data), Prisma, Stripe, Tailwind, existing Acoustic Kitty design system.

---

## Scope

1. Rename `hoa_live_` → `ak_live_` and `@houseofagents_bot` → `@AcoustickittyBot` everywhere
2. Strip all Playground references (copy + component deletion)
3. Bump `MODEL_TIER_WEIGHTS.premium` from 5 → 10 (makes premium agents profitable on more tiers)
4. Remove fake homepage stats (287ms, 99.9% uptime, 11 categories claim, fake LIVE INTERCEPT feed)
5. Rewrite pricing page FAQ — kill the "35%" public mention, reframe to dollar earnings
6. Add `<BotQR />` component showing Telegram deep link QR; place on landing + getting-started + /link
7. Update privacy policy with Telegram data clauses
8. Rewrite nav to plain English (Agents / Pricing / Developers / Providers / Sign in)
9. Fix API doc base URL inconsistency + add error response examples, idempotency, webhook signature sections

## Out of scope (separate plans)

- Bot token swap + webhook re-registration (blocked on BotFather + Railway env update — plan will ship code but deploy waits on user)
- Benchmarking infrastructure (separate plan)
- Signup flow split (separate plan)
- Credits migration (not needed — call weighting already IS credits)
- Provider API spec doc (separate plan)
- Async/webhook callback pattern (separate plan — documentation only here)

## Deployment gates

- Every code change must pass `npm run build` before commit
- `npm run lint` must pass
- Manual smoke test on affected pages before declaring done

---

## Task 1: Rename API key prefix `hoa_live_` → `ak_live_`

**Files:**
- Modify: `src/lib/apikeys.ts`
- Modify: `src/app/reference/page.tsx` (docs show the old prefix)
- Modify: `src/app/getting-started/page.tsx`
- Modify: `src/app/LandingClient.tsx`
- Modify: `src/components/RegisterFlow.tsx`
- Modify: `prisma/seed.ts`
- Modify: `public/llms.txt`

**Steps:**

- [ ] Grep for all occurrences: `grep -rn "hoa_live_" src/ prisma/ public/`
- [ ] Replace every `hoa_live_` with `ak_live_` in each file
- [ ] Verify the prefix constant in `src/lib/apikeys.ts` is the only source of truth (if not, consolidate)
- [ ] Add a backwards-compat path: existing keys starting `hoa_live_` must still authenticate. Add comment noting this is a one-cycle migration — keys created going forward are `ak_live_`
- [ ] Run `npm run build`
- [ ] Commit: `chore: rename API key prefix hoa_live_ to ak_live_`

## Task 2: Update Telegram bot handle `@houseofagents_bot` → `@AcoustickittyBot`

**Files:** grep-driven — any page/doc referencing the bot handle.

**Steps:**

- [ ] Grep: `grep -rn "houseofagents_bot\|houseofagents bot" src/`
- [ ] Replace every instance with `AcoustickittyBot` (no underscore — the confirmed handle)
- [ ] Update deep-link URLs: `t.me/houseofagents_bot` → `t.me/AcoustickittyBot`
- [ ] Update llms.txt
- [ ] Commit: `chore: update telegram bot handle to AcoustickittyBot`

## Task 3: Remove Playground — component + all references

**Files:**
- Delete: `src/components/ApiPlayground.tsx`
- Modify: any page that imports `ApiPlayground` or mentions "playground"

**Steps:**

- [ ] Grep for imports and references: `grep -rn "ApiPlayground\|playground\|Playground" src/`
- [ ] Remove every import of the component
- [ ] Remove any `<ApiPlayground />` usage
- [ ] Replace copy that references the playground ("try it in the playground" → "call the API directly" or similar)
- [ ] Delete the component file
- [ ] Run `npm run build` to catch missed references
- [ ] Commit: `chore: remove playground — feature not implemented`

## Task 4: Bump premium model weight 5 → 10

**Files:**
- Modify: `src/lib/plans.ts`
- Modify: `src/app/agents/[slug]/page.tsx` (displayed weight)
- Modify: `src/components/AgentCard.tsx` (displayed weight)
- Modify: `src/app/LeaderboardClient.tsx` (displayed weight)
- Modify: `src/app/pricing/page.tsx` (documented weight)

**Steps:**

- [ ] Change `MODEL_TIER_WEIGHTS.premium` from `5` to `10` in `src/lib/plans.ts:77`
- [ ] Search for any hardcoded `5` referring to the premium weight (grep `"premium: 5"\|standard: 2, premium: 5`)
- [ ] Replace any duplicated weight map in components with an import from `plans.ts` (or update the hardcode to `10`)
- [ ] Update any copy on pricing page that describes weights
- [ ] Run `npm run build`
- [ ] Commit: `fix(pricing): bump premium weight 5→10 for provider margin on volume tiers`

## Task 5: Strip fake homepage stats

**Files:**
- Modify: `src/app/LandingClient.tsx`
- Modify: `src/app/page.tsx`

**Steps:**

- [ ] Remove or replace "287ms avg latency" — use "Station AK/01 · Accepting new agents" or similar honest placeholder until real metrics exist
- [ ] Remove or replace "99.9% uptime"
- [ ] Check for any "11 categories" copy — replace with actual count (dynamically computed or hardcoded to 3-5 depending on final commitment)
- [ ] Kill the fake "LIVE INTERCEPT · ROUTING FEED" — replace with static "Station AK/01 · accepting agents" block. Remove the cycling animation.
- [ ] Grep `287\|99.9\|LIVE INTERCEPT\|ROUTING FEED` to catch stragglers
- [ ] Commit: `fix: remove invented performance stats and fake live feed`

## Task 6: Pricing FAQ — remove public "35%" mention

**Files:**
- Modify: `src/app/pricing/page.tsx`

**Steps:**

- [ ] Find FAQ entry "How does the provider revenue split work?" (line ~31-34)
- [ ] Replace with: focus on what providers earn in dollars, not percentages.
- [ ] New answer: "Providers set a credit cost per call (1 credit ≈ $0.01). Every call to your agent contributes to a monthly payout via Stripe Connect. Higher-rated agents earn proportionally more per call. Payouts processed monthly, $50 minimum threshold. See provider terms for full fee schedule."
- [ ] Keep the split documented in ToS / provider terms — do NOT expose on public pricing page
- [ ] Commit: `copy(pricing): reframe revenue split as dollar earnings, not percentages`

## Task 7: Add `<BotQR />` component + deep link

**Files:**
- Create: `src/components/BotQR.tsx`
- Modify: `src/app/LandingClient.tsx` (add QR block in the "Two ways to use" section)
- Modify: `src/app/getting-started/page.tsx` (add QR in Telegram section)
- Modify: `src/app/link/page.tsx` (add QR — primary link flow target)
- Modify: `package.json` — add `react-qr-code` dependency

**Steps:**

- [ ] `npm install react-qr-code` (~5KB, SVG-based, no server code)
- [ ] Create `src/components/BotQR.tsx`:

```tsx
"use client";
import QRCode from "react-qr-code";

const BOT_URL = "https://t.me/AcoustickittyBot";

type Props = { size?: number; caption?: string };

export function BotQR({ size = 160, caption = "Scan to open @AcoustickittyBot" }: Props) {
  return (
    <div className="inline-flex flex-col items-center gap-2">
      <div className="rounded-lg border border-ak-ink/15 bg-white p-3">
        <QRCode value={BOT_URL} size={size} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
      </div>
      <a
        href={BOT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs uppercase tracking-wider text-ak-ink/70 hover:text-ak-ink"
      >
        {caption}
      </a>
    </div>
  );
}
```

- [ ] Import and place on landing page Telegram section
- [ ] Import and place on getting-started (Telegram onboarding)
- [ ] Import and place on `/link` page
- [ ] Run `npm run build`
- [ ] Commit: `feat: add BotQR component for one-scan Telegram onboarding`

## Task 8: Update privacy policy — Telegram clauses

**Files:**
- Modify: `src/app/privacy/page.tsx`

**Steps:**

- [ ] Read current privacy policy
- [ ] Add a section "Telegram integration" covering:
  - What Telegram data we collect (user ID, username, message content for routing)
  - How we use it (route task, associate with linked Acoustic Kitty account, metered billing)
  - Retention (chat transcripts retained 90 days, Telegram user ID linkage persists until account deletion)
  - Third-party: Telegram's own privacy policy applies for data held on their side
- [ ] Update "last updated" date at top of policy
- [ ] Commit: `docs(privacy): add Telegram integration data clauses`

## Task 9: Navigation rewrite to plain English

**Files:**
- Modify: header nav component (grep to locate — likely in `src/app/layout.tsx` or a `Header.tsx`)

**Steps:**

- [ ] Grep for nav labels — find existing spy-coded labels
- [ ] Replace with plain English:
  - `Agents` (→ /agents or leaderboard)
  - `Pricing` (→ /pricing)
  - `Developers` (→ /getting-started, becomes /for-developers in later plan)
  - `Providers` (→ /provider or /for-providers)
  - `Sign in` (→ existing auth path)
- [ ] Keep footer themed (per brand strategy — functional surfaces plain, marketing theme-forward)
- [ ] Run `npm run build`
- [ ] Commit: `copy(nav): plain-english header, themed footer stays`

## Task 10: API reference — consistency + missing sections

**Files:**
- Modify: `src/app/reference/page.tsx`

**Steps:**

- [ ] Audit all endpoint paths — ensure consistent `/api/v1/` prefix (grep for `/api/` in the file, then fix stragglers)
- [ ] Update all `hoa_live_` examples to `ak_live_` (handled in Task 1 if same file, but verify)
- [ ] Add error responses section with example bodies for 400 / 401 / 404 / 429 / 500
- [ ] Add idempotency section: `Idempotency-Key` header usage, 24-hour dedup, same response returned
- [ ] Add webhook signature section: `X-AcousticKitty-Signature` HMAC header, verification snippet
- [ ] Clarify `cost_cents` field in examples — what unit, what zero means
- [ ] Commit: `docs(api): fix base URL consistency, add error/idempotency/webhook sections`

## Task 11: Final smoke test

- [ ] Start dev server: `npm run dev`
- [ ] Visit homepage — no "287ms", "99.9%", "11 categories", "LIVE INTERCEPT" text, no playground links
- [ ] Visit `/pricing` — FAQ no longer mentions "35%"
- [ ] Visit `/getting-started` — no playground reference, QR code visible in Telegram section
- [ ] Visit `/link` — QR code visible
- [ ] Visit `/reference` — all `ak_live_` prefixes, error responses listed, idempotency documented
- [ ] Visit `/privacy` — Telegram clauses present
- [ ] Click the bot QR / deep link — opens `t.me/AcoustickittyBot` (will 404 in Telegram until BotFather set up, but link itself should be correct)
- [ ] Run `npm run build` — no errors
- [ ] Run `npm run lint` — no new warnings

## Deploy

- [ ] Push to `main`
- [ ] Railway auto-deploys
- [ ] Smoke-test production URLs
- [ ] Flag user: BotFather setup + Railway env swap for the bot token (separate step — not blocking this plan)
