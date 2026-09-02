import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  // Simple secret-based auth for one-time admin operations
  const secret = request.headers.get('x-admin-secret');
  if (secret !== process.env.BENCHMARK_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { slugs, action } = await request.json();

  if (action === 'activate' && Array.isArray(slugs)) {
    const result = await prisma.agent.updateMany({
      where: { slug: { in: slugs } },
      data: { status: 'active' },
    });
    return NextResponse.json({ updated: result.count, status: 'active' });
  }

  if (action === 'set-provider') {
    const { apiKey } = await request.json();
    const result = await prisma.user.updateMany({
      where: { apiKey },
      data: { role: 'provider' },
    });
    return NextResponse.json({ updated: result.count });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
