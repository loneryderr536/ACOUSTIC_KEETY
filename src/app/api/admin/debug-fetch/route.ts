import { NextResponse } from 'next/server';

// Debug endpoint removed for production — was temporary for agent validation diagnostics
export async function POST() {
  return NextResponse.json({ error: 'Endpoint removed' }, { status: 410 });
}
