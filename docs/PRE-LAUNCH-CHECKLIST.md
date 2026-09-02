# Pre-Launch Checklist

**Last updated:** 2026-04-24
**Purpose:** three open items that I (Claude) can't finish unassisted. Each has precise steps so you can do them solo.

Three items in order of importance:

1. [Verify the successful Stripe Transfer path](#1-verify-the-successful-stripe-transfer-path)
2. [Schedule the payout runner](#2-schedule-the-payout-runner)
3. [Remove the test-harness before public launch](#3-remove-the-test-harness-before-public-launch)

---

## 1. Verify the successful Stripe Transfer path

**Why:** everything else in the payments pipeline is proven live (credits math, skip paths, failure paths, roll-forward). The only untested branch is the `paid` status — because it needs a real test-mode Connected Account with `payouts_enabled: true`.

**What success looks like:** a Payout row with `status=paid`, a real `stripeTransferId=tr_...`, and the transfer visible in Stripe's test-mode dashboard.

### Step 1 — create a test provider on production using real signup

```bash
# From your terminal. Change the email to anything you don't mind keeping.
TS=$(date +%s)
PROV_EMAIL="qa-stripe-${TS}@yourdomain.com"

curl -sS -X POST https://acoustickitty.ai/api/providers/register \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${PROV_EMAIL}\",\"name\":\"Stripe QA\"}"
```

Copy the `apiKey` from the response — you'll need it as `$PROV_KEY` below.

### Step 2 — kick off Stripe Connect Express onboarding

```bash
PROV_KEY="ak_live_..."  # from step 1

curl -sS -X POST https://acoustickitty.ai/api/stripe/connect \
  -H "Authorization: Bearer ${PROV_KEY}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response contains `{"url": "https://connect.stripe.com/express/..."}`. Open that URL in a browser.

### Step 3 — complete the Express onboarding with Stripe test values

Stripe's test mode accepts these test values to breeze through:

| Field | Test value |
|---|---|
| Phone | `000-000-0000` |
| SMS verification code | `000000` |
| Legal name | any |
| Date of birth | `01/01/1901` |
| SSN / ID | `000-00-0000` |
| Address | any valid-format US address |
| Bank routing number | `110000000` |
| Bank account number | `000123456789` |
| Industry | any |

After the last page you'll be redirected back to `/provider/dashboard?stripe=connected&accountId=acct_...`. The `acct_...` is now on the user row. You can verify:

```bash
curl -sS https://acoustickitty.ai/api/stripe/connect \
  -H "Authorization: Bearer ${PROV_KEY}"
```

Expected: `{"connected": true, "onboardingComplete": true, "readyToReceivePayments": true, ...}`.

If `readyToReceivePayments: false` — onboarding isn't actually finished. Go back through the flow.

### Step 4 — create a synthetic agent + seed enough credits to cross the $50 minimum

Provider share is 65% of credits × $0.01. To cross $50:
- **7,693 credits** minimum (rounded up to 7,700 for safety)
- At Haiku rate (1 credit/call) = 7,700 calls
- At Premium rate (10 credits/call) = 770 calls

Use 770 Premium calls — fewer rows, same result.

```bash
SECRET="acoustickitty-1010"   # BENCHMARK_CRON_SECRET — confirm on Railway first

# 4a. Register a synthetic Premium agent (harness bypasses the endpoint
#     validator and tier-force so we can hit Premium directly in test.)
curl -sS -X POST https://acoustickitty.ai/api/admin/test-harness \
  -H "x-admin-secret: ${SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"register-agent\",\"providerApiKey\":\"${PROV_KEY}\",\"slug\":\"stripe-qa-${TS}\",\"name\":\"Stripe QA ${TS}\",\"category\":\"research\",\"modelTier\":\"premium\"}"

# 4b. Seed 770 successful calls — 770 × 10 credits = 7,700 = $77 gross
curl -sS -X POST https://acoustickitty.ai/api/admin/test-harness \
  -H "x-admin-secret: ${SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"seed-calls\",\"providerApiKey\":\"${PROV_KEY}\",\"count\":770}"
```

Expected seed-calls response:
```
{
  "action": "seed-calls",
  "seeded": 770,
  "modelTier": "premium",
  "creditsPerCall": 10,
  "totalCreditsConsumed": 7700,
  "grossCents": 7700,
  ...
}
```

Verify the pending earnings:

```bash
curl -sS https://acoustickitty.ai/api/provider/stats \
  -H "Authorization: Bearer ${PROV_KEY}" | python3 -m json.tool | grep -A 3 earnings
```

Expected: `pendingGrossCents: 7700`, `pendingProviderShareCents: 5005` — just over the $50 minimum.

### Step 5 — run the payout

```bash
# Dry-run first to preview
curl -sS -X POST https://acoustickitty.ai/api/admin/payouts \
  -H "x-admin-secret: ${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"dryRun": true}'

# If the dry-run looks right, do it for real
curl -sS -X POST https://acoustickitty.ai/api/admin/payouts \
  -H "x-admin-secret: ${SECRET}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected in the real run: your test provider's result object includes `"status": "paid"`, `"stripeTransferId": "tr_..."`, `"payoutId": "..."`, `"providerShareCents": 5005`.

### Step 6 — verify both sides

**Our side:**
```bash
curl -sS https://acoustickitty.ai/api/provider/payouts \
  -H "Authorization: Bearer ${PROV_KEY}" | python3 -m json.tool
```

One row with `status: paid`, non-null `stripeTransferId`, `paidAt` populated.

**Stripe side:**
- Stripe Dashboard → toggle to test mode (top right)
- Connect → Accounts → find the test provider by the `acct_...` ID
- Transfers tab → look for a Transfer with amount `$50.05`, matching `payoutId` in the metadata

If both match: the paid path is proven. Record the Transfer ID somewhere for the record.

### Step 7 — clean up the test provider

```bash
curl -sS -X POST https://acoustickitty.ai/api/admin/test-harness \
  -H "x-admin-secret: ${SECRET}" \
  -H "Content-Type: application/json" \
  -d "{\"action\":\"purge\",\"emailPrefix\":\"qa-stripe-${TS}\"}"
```

This deletes the provider, their agents, all synthetic call rows, and their Payout rows. The Stripe Connected Account stays (you can reject/remove it from Stripe dashboard if you want).

### Common failure modes

- **`readyToReceivePayments: false`** — onboarding isn't finished. Complete all pages.
- **Payout returns `status: skipped, skipReason: payouts_not_enabled`** — Stripe account retrievable but not yet capable of payouts. Usually means onboarding incomplete.
- **Payout returns `status: failed, failureReason: "account_retrieve: ..."` on a real test account** — your Stripe secret key env might be pointing at the live environment or a different Stripe account. Check `STRIPE_SECRET_KEY` in Railway.
- **`status: skipped, skipReason: below_minimum`** despite seeding enough calls** — you already ran a payout earlier and some calls were included in a prior window. Roll forward by seeding more calls.

---

## 2. Schedule the payout runner

Today the payout runner is invoked manually via `POST /api/admin/payouts`. For production it needs to fire on a schedule — monthly or weekly — so providers get paid without you thinking about it.

Three options in order of simplicity:

### Option A — Railway Cron Job (recommended)

Railway natively supports cron. In `railway.toml` or via the Railway dashboard:

1. Railway dashboard → your service → **Settings** → **Scheduled Deployments** (or **Cron**)
2. Add a new cron with:
   - **Schedule:** `0 2 1 * *` (02:00 UTC on the 1st of each month)
   - **Command:**
     ```sh
     curl -sS -X POST https://acoustickitty.ai/api/admin/payouts \
       -H "x-admin-secret: ${BENCHMARK_CRON_SECRET}" \
       -H "Content-Type: application/json" \
       -d '{}'
     ```
3. Save. Railway stores the cron as part of the service config.

Pick a time that's off-peak for you in case you want to manually review results the next morning.

### Option B — GitHub Actions scheduled workflow

If Railway's cron isn't working out, use GitHub Actions. Create `.github/workflows/payout-runner.yml`:

```yaml
name: Monthly payout runner

on:
  schedule:
    # 02:00 UTC on the 1st of each month
    - cron: '0 2 1 * *'
  workflow_dispatch: {}  # allows manual trigger from the Actions tab

jobs:
  run-payouts:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger payouts
        env:
          ADMIN_SECRET: ${{ secrets.BENCHMARK_CRON_SECRET }}
        run: |
          response=$(curl -sS -w "\nHTTP_CODE:%{http_code}" \
            -X POST https://acoustickitty.ai/api/admin/payouts \
            -H "x-admin-secret: $ADMIN_SECRET" \
            -H "Content-Type: application/json" \
            -d '{}')
          echo "$response"
          code=$(echo "$response" | grep HTTP_CODE | cut -d: -f2)
          if [ "$code" != "200" ]; then
            echo "Payout runner returned HTTP $code"
            exit 1
          fi
```

Then in GitHub → your repo → Settings → Secrets and variables → Actions → add `BENCHMARK_CRON_SECRET`.

### Option C — Manual, calendar reminder

Honestly fine for the first few months at small volume. Calendar reminder on the 1st of each month → paste the curl in step 5 above. Upgrade to A or B when traffic warrants.

### Recommendation

**Option A for production.** It lives with the rest of the infra, auth is already handled via Railway env, and it fails in the Railway logs you're already watching.

---

## 3. Remove the test-harness before public launch

`src/app/api/admin/test-harness/route.ts` is admin-secret gated but still dangerous: anyone with the admin secret (a single env var) can mint unlimited synthetic earnings against real providers. It also has a `purge` action that deletes users in bulk. This file should not exist in production when real users are signing up.

**Keep it** during your Stripe test (item 1 above) and any final QA. Remove it as the last step before opening signups to the public.

### When to do it

- After all P0 testing is done
- Right before announcing the launch publicly / enabling marketing

### How to do it

Ask me to do it. The exact commands:

```bash
cd /Users/rav/Documents/bigkahoona

# 1. Purge any synthetic QA users still in the database
curl -sS -X POST https://acoustickitty.ai/api/admin/test-harness \
  -H "x-admin-secret: ${BENCHMARK_CRON_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"action":"purge","emailPrefix":"qa-"}'
# Repeat with other prefixes you might have used: probe-, etc.

# 2. Delete the route file
rm src/app/api/admin/test-harness/route.ts

# 3. Verify nothing else imports from it
grep -r "test-harness" src/ || true
# Expected: no matches.

# 4. Commit & push
git add -u src/app/api/admin/
git commit -m "chore: remove test-harness route before public launch"
git push origin main
```

Railway redeploys. The endpoint returns 404 thereafter.

### Alternative: keep it, gate it harder

If you want to keep it for staging but not production, wrap the handler in a feature-flag check:

```ts
if (process.env.ENABLE_TEST_HARNESS !== 'true') {
  return NextResponse.json({ error: 'Endpoint disabled' }, { status: 404 });
}
```

Set `ENABLE_TEST_HARNESS=true` in staging, leave it unset in production. Less clean than removing it, but preserves QA capability.

---

## Quick sanity check at any time

A few one-liners to check the state of things without running a full sim:

```bash
SECRET="..."  # BENCHMARK_CRON_SECRET

# Recent payouts — admin view (last 50 across all providers)
curl -sS https://acoustickitty.ai/api/admin/payouts -H "x-admin-secret: $SECRET" | python3 -m json.tool

# Provider-scoped payouts — provider view
curl -sS https://acoustickitty.ai/api/provider/payouts -H "Authorization: Bearer $PROV_KEY" | python3 -m json.tool

# Provider's current pending earnings
curl -sS https://acoustickitty.ai/api/provider/stats -H "Authorization: Bearer $PROV_KEY" | python3 -m json.tool

# Platform health
curl -sS https://acoustickitty.ai/api/v1/health | python3 -m json.tool
```
