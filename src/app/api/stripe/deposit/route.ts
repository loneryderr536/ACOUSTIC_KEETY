import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth';
import { createDepositCheckout } from '@/stripe/deposits';
import { appUrl } from '@/stripe/connect';

/**
 * NEW — the provider listing deposit checkout, ported from the standalone
 * service. BigKahoona had the Agent columns for this but no route.
 *
 * POST /api/stripe/deposit   { agentId?: string }
 */
export async function POST(request: NextRequest) {
  const user = await resolveUser(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let agentId: string | undefined;
  try {
    const body = await request.json();
    agentId = body?.agentId;
  } catch {
    // Body is optional — a deposit without a specific listing is fine.
  }

  const result = await createDepositCheckout({
    userId: user.id,
    email: user.email,
    agentId,
    baseUrl: appUrl(request.headers.get('origin')),
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ url: result.url });
}
