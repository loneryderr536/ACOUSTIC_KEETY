import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { issueAccessToken } from '@/lib/jwt';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { apiKey } = body;

    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid apiKey in request body' },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({ where: { apiKey } });
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid API key' },
        { status: 401 },
      );
    }

    const accessToken = issueAccessToken({
      userId: user.id,
      role: user.role,
      plan: user.plan,
    });

    return NextResponse.json({
      accessToken,
      expiresIn: 3600,
      tokenType: 'Bearer',
    });
  } catch (error) {
    console.error('[POST /api/auth/token]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
