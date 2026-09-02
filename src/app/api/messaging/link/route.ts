import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth';
import { getRedisClient } from '@/lib/redis';
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

  const redis = getRedisClient();
  if (!redis) {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }

  const linkData = await redis.get(`link:${code.toUpperCase()}`);
  if (!linkData) {
    return NextResponse.json({ error: 'Invalid or expired code' }, { status: 400 });
  }

  const { platform, platformUserId } = JSON.parse(linkData);

  await prisma.messagingLink.upsert({
    where: { platform_platformUserId: { platform, platformUserId } },
    create: { platform, platformUserId, userId: user.id },
    update: { userId: user.id },
  });

  await redis.del(`link:${code.toUpperCase()}`);

  return NextResponse.json({ linked: true, platform });
}
