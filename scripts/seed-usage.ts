/**
 * Generates realistic ApiCall rows so the payout engines have something to
 * calculate from.
 *
 *   npx tsx scripts/seed-usage.ts
 *   npx tsx scripts/seed-usage.ts 2026-09 400
 *
 * Nothing here touches Stripe or money — it only writes usage history, so it
 * is safe to re-run. Each run clears the seeded calls for that period first,
 * so numbers don't accumulate across runs and confuse a payout comparison.
 *
 * Why this exists: both payout engines read `ApiCall` rows, and both support a
 * dry run. With usage seeded you can run each engine in dry-run mode against
 * identical data and compare what they'd pay — which is the fastest way to
 * decide which one you actually want, without moving a cent.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Mirrors MODEL_TIER_WEIGHTS in src/lib/plans.ts. Kept as a literal rather than
// imported so this script stays runnable outside the Next module graph.
const TIER_WEIGHTS: Record<string, number> = { haiku: 1, standard: 2, premium: 10, unknown: 1 };

function periodKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * A date inside the given YYYY-MM, never in the future.
 *
 * The first version of this spread calls across the whole month, which for the
 * current month means most of them were dated days ahead. That looked fine to
 * the monthly pool engine — it filters on the `periodKey` label — but the
 * rolling engine aggregates on `createdAt < now` and correctly ignored calls
 * that had not happened yet, so the two engines silently disagreed on how much
 * usage even existed. Clamping to now keeps seeded history plausible.
 */
function randomDateIn(periodKey: string): Date {
  const [y, m] = periodKey.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1);
  const monthEnd = Date.UTC(y, m, 1);
  const end = Math.min(monthEnd, Date.now());
  if (end <= start) {
    throw new Error(`Period ${periodKey} has not started yet — nothing to seed.`);
  }
  return new Date(start + Math.random() * (end - start - 1));
}

async function main() {
  const periodKey = process.argv[2] || periodKeyOf(new Date());
  const callCount = Number(process.argv[3] || 300);

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) {
    throw new Error(`Bad period key "${periodKey}" — expected YYYY-MM, e.g. 2026-09`);
  }

  const subscriber = await prisma.user.findFirst({
    where: { role: "subscriber" },
    orderBy: { createdAt: "asc" },
  });
  if (!subscriber) throw new Error("No subscriber found — run `npx prisma db seed` first.");

  // Deliberately NOT filtering on status 'active'.
  //
  // The orchestrator's health monitor demotes agents to 'degraded'/'unhealthy'
  // when their endpoint doesn't answer — which is every seeded agent, since
  // they point at demo URLs that don't exist. But this script writes HISTORICAL
  // usage, and an agent's health today says nothing about whether it served a
  // call last week. The payout engines agree: they exclude only 'suspended'.
  const agents = await prisma.agent.findMany({
    where: { status: { not: "suspended" } },
    select: { id: true, name: true, slug: true, native: true, status: true, modelTier: true, rating: true, reviewCount: true },
  });
  if (agents.length === 0) throw new Error("No agents found — run `npx prisma db seed` first.");

  const statuses = [...new Set(agents.map((a) => a.status))].join(", ");
  console.log(`Using ${agents.length} agents (status: ${statuses})`);

  // Clear previous seeded usage for this period so re-runs stay comparable.
  const cleared = await prisma.apiCall.deleteMany({ where: { periodKey } });
  if (cleared.count > 0) console.log(`Cleared ${cleared.count} existing calls for ${periodKey}`);

  // Weight the distribution so it isn't uniform — a real marketplace has a few
  // popular agents and a long tail. Index 0 gets the most traffic.
  const weights = agents.map((_, i) => 1 / (i + 1));
  const weightTotal = weights.reduce((a, b) => a + b, 0);

  function pickAgent() {
    let r = Math.random() * weightTotal;
    for (let i = 0; i < agents.length; i++) {
      r -= weights[i];
      if (r <= 0) return agents[i];
    }
    return agents[agents.length - 1];
  }

  const rows = [];
  for (let i = 0; i < callCount; i++) {
    const agent = pickAgent();
    const credits = TIER_WEIGHTS[agent.modelTier] ?? 1;
    // ~4% of calls fail. Failed calls earn nothing — both engines filter on
    // status 'success' — so this also proves the filter is doing its job.
    const failed = Math.random() < 0.04;

    rows.push({
      subscriberId: subscriber.id,
      agentId: agent.id,
      routingStrategy: "performance",
      latencyMs: Math.round(80 + Math.random() * 900),
      status: failed ? "error" : "success",
      creditsConsumed: failed ? 0 : credits,
      costCents: 0,
      periodKey,
      createdAt: randomDateIn(periodKey),
      ...(failed ? { errorMessage: "seeded failure" } : {}),
    });
  }

  await prisma.apiCall.createMany({ data: rows });

  // ── report ────────────────────────────────────────────────────────────
  const succeeded = rows.filter((r) => r.status === "success");
  const totalCredits = succeeded.reduce((s, r) => s + r.creditsConsumed, 0);

  const byAgent = new Map<string, { credits: number; calls: number }>();
  for (const r of succeeded) {
    const cur = byAgent.get(r.agentId) ?? { credits: 0, calls: 0 };
    cur.credits += r.creditsConsumed;
    cur.calls += 1;
    byAgent.set(r.agentId, cur);
  }

  console.log(`\nSeeded ${rows.length} calls for ${periodKey} (${succeeded.length} successful)`);
  console.log(`Total credits consumed: ${totalCredits}  =  $${(totalCredits / 100).toFixed(2)} of attributable value\n`);

  for (const a of agents) {
    const stat = byAgent.get(a.id);
    if (!stat) continue;
    const tag = a.native ? " [NATIVE — retained, not paid out]" : "";
    const rated = a.reviewCount === 0 ? "unrated" : `${a.rating?.toFixed(1)}★`;
    console.log(
      `  ${a.name.padEnd(16)} ${String(stat.calls).padStart(4)} calls  ` +
      `${String(stat.credits).padStart(5)} credits  ${rated.padStart(8)}${tag}`,
    );
  }

  console.log(`\nNow dry-run each engine and compare what they would pay.`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
