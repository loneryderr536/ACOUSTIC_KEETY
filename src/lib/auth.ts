import { prisma } from './prisma';
import { verifyAccessToken } from './jwt';

export async function resolveUser(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);

  // Try JWT first (starts with eyJ)
  if (token.startsWith('eyJ')) {
    const payload = verifyAccessToken(token);
    if (!payload) return null;
    return prisma.user.findUnique({ where: { id: payload.userId } });
  }

  // Fall back to API key
  return prisma.user.findUnique({ where: { apiKey: token } });
}
