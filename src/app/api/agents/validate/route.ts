import { NextRequest, NextResponse } from 'next/server';
import { resolveUser } from '@/lib/auth';
import { validateAgentEndpoints } from '@/lib/agent-validation';

export async function POST(request: NextRequest) {
  const user = await resolveUser(request.headers.get('authorization'));
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { endpointUrl } = await request.json();
  if (!endpointUrl) {
    return NextResponse.json({ error: 'endpointUrl required' }, { status: 400 });
  }

  const result = await validateAgentEndpoints(endpointUrl);
  return NextResponse.json(result);
}
