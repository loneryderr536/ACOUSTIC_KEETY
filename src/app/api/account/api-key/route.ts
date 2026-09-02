import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { resolveUser } from '@/lib/auth';
import { generateApiKey } from '@/lib/apikeys';

export async function POST(request: NextRequest) {
  try {
    const subscriber = await resolveUser(request.headers.get('authorization'));
    if (!subscriber) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    const newKey = generateApiKey();

    await prisma.user.update({
      where: { id: subscriber.id },
      data: { apiKey: newKey },
    });

    return NextResponse.json({
      apiKey: newKey,
      previousKeyRevoked: true,
      message: 'New key active. Previous key is now invalid.',
    });
  } catch (error) {
    console.error('[POST /api/account/api-key]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
