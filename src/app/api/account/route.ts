import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth';

function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 12) return '****';
  return apiKey.slice(0, 8) + '…' + apiKey.slice(-4);
}

export async function GET(request: NextRequest) {
  try {
    const subscriber = await resolveUser(request.headers.get('authorization'));
    if (!subscriber) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    return NextResponse.json({
      id: subscriber.id,
      email: subscriber.email,
      name: subscriber.name,
      role: subscriber.role,
      plan: subscriber.plan,
      callsUsed: subscriber.callsUsed,
      callsLimit: subscriber.callsLimit,
      apiKey: subscriber.apiKey ? maskApiKey(subscriber.apiKey) : null,
      createdAt: subscriber.createdAt,
    });
  } catch (error) {
    console.error('[GET /api/account]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
