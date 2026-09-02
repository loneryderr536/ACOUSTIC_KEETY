import { prisma } from './prisma';
import { getPlanConfig } from './plans';

/**
 * Daily replenishment: add dailyAllowance to callsBalance, capped at callsLimit.
 * Runs once per day via orchestrator.
 */
export async function dailyReplenishment() {
  // Get all paid users (recruit has hard cap, no rolling replenishment)
  const users = await prisma.user.findMany({
    where: {
      plan: { notIn: ['recruit', 'explorer'] },
    },
    select: { id: true, plan: true, callsBalance: true, callsLimit: true },
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
