import { prisma } from '@/lib/prisma';
import { currentPeriodKey } from './period';

/**
 * Period tagging for usage.
 *
 * CONFLICT FIX: the standalone service carried its own `UsageEvent` model,
 * which is the same concept as BigKahoona's existing `ApiCall` — one row per
 * time a subscriber's request actually used an agent. Adding both would have
 * meant two tables recording the same fact and a payout engine reading the
 * empty one. So the *logic* was kept and the table was not: `ApiCall` gains a
 * `periodKey` column, and the mapping is
 *
 *     UsageEvent.consumerId  ->  ApiCall.subscriberId
 *     UsageEvent.agentId     ->  ApiCall.agentId
 *     UsageEvent.weight      ->  ApiCall.creditsConsumed
 *     UsageEvent.periodKey   ->  ApiCall.periodKey
 *
 * `creditsConsumed` is already snapshotted at call time from the agent's model
 * tier, so it is a strictly better weight than the standalone service's flat
 * default of 1.
 *
 * The line the standalone service flagged as "the fix — this line was missing
 * entirely" is `periodKey` being set at write time. Same fix here: whatever
 * records an ApiCall must stamp the period, or the monthly payout job has
 * nothing to aggregate.
 */
export function usagePeriodKey(at: Date = new Date()): string {
  return currentPeriodKey(at);
}

/**
 * Backfill `periodKey` on ApiCall rows written before the column existed.
 * Safe to re-run; only touches rows where it is still null.
 */
export async function backfillUsagePeriodKeys(batchSize = 1000): Promise<number> {
  const rows = await prisma.apiCall.findMany({
    where: { periodKey: null },
    select: { id: true, createdAt: true },
    take: batchSize,
  });

  for (const row of rows) {
    await prisma.apiCall.update({
      where: { id: row.id },
      data: { periodKey: currentPeriodKey(row.createdAt) },
    });
  }

  return rows.length;
}
