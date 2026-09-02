import { prisma } from './prisma';

/**
 * The marketplace's own identity as a provider.
 *
 * Native agents — the ones Acoustic Kitty hosts itself rather than listing on
 * behalf of a third party — still need an owner, because `Agent.providerId` is
 * a foreign key to `User`. Rather than relax that constraint, the platform gets
 * a real `User` row of its own. Everything native hangs off it.
 *
 * This is the same row `PLATFORM_USER_ID` should point at, so the monthly
 * payout run can write its `retained_native` reporting line. Create it once
 * (via the admin route or the seed), then copy the id into that env var.
 */
export const PLATFORM_EMAIL = process.env.PLATFORM_PROVIDER_EMAIL || 'station@acoustickitty.ai';
export const PLATFORM_NAME = 'Acoustic Kitty';

export async function getOrCreatePlatformUser() {
  // Prefer an explicit id if one is configured — that is the row the payout
  // engine will use, so the two must not drift apart.
  const configuredId = process.env.PLATFORM_USER_ID;
  if (configuredId) {
    const byId = await prisma.user.findUnique({ where: { id: configuredId } });
    if (byId) return byId;
    console.warn(
      `[platform] PLATFORM_USER_ID=${configuredId} does not match any user — falling back to ${PLATFORM_EMAIL}`,
    );
  }

  return prisma.user.upsert({
    where: { email: PLATFORM_EMAIL },
    update: { role: 'provider' },
    create: {
      email: PLATFORM_EMAIL,
      name: PLATFORM_NAME,
      role: 'provider',
      // The platform never pays itself out, but the payout engine reads these
      // flags before it will write a ledger row against a user.
      onboardingComplete: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    },
  });
}
