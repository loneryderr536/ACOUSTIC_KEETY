import { NextResponse } from 'next/server';

// Debug endpoint removed for production — use Railway dashboard for env var management
export async function GET() {
  return NextResponse.json({ error: 'Endpoint removed' }, { status: 410 });
}
