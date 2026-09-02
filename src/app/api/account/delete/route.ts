import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest) {
  try {
    const user = await resolveUser(request.headers.get('authorization'));
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Delete in order (respecting foreign keys):
    // 1. User's own API call history (as subscriber)
    // 2. User's reviews
    // 3. User's sessions
    // 4. User's messaging links
    // 5. If provider: their agents' health checks, benchmarks, and API calls
    // 6. If provider: their agents themselves
    // 7. The user record
    await prisma.$transaction([
      prisma.apiCall.deleteMany({ where: { subscriberId: user.id } }),
      prisma.review.deleteMany({ where: { userId: user.id } }),
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.messagingLink.deleteMany({ where: { userId: user.id } }),
      prisma.healthCheck.deleteMany({ where: { agent: { providerId: user.id } } }),
      prisma.benchmark.deleteMany({ where: { agent: { providerId: user.id } } }),
      prisma.apiCall.deleteMany({ where: { agent: { providerId: user.id } } }),
      prisma.agent.deleteMany({ where: { providerId: user.id } }),
      prisma.user.delete({ where: { id: user.id } }),
    ]);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    console.error('[DELETE /api/account/delete]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
