import { NextRequest, NextResponse } from 'next/server';

/* ------------------------------------------------------------------ */
/*  POST /api/mock/agent — mock agent for testing                      */
/* ------------------------------------------------------------------ */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

  // Simulate processing delay (100-500ms)
  await new Promise(r => setTimeout(r, 100 + Math.random() * 400));

  return NextResponse.json({
    status: 'ok',
    agent: 'mock-agent',
    task: body.task || 'unknown',
    result: {
      summary: `Processed task: ${body.task || 'unknown'}`,
      confidence: 0.95,
      tokens_used: Math.floor(Math.random() * 500) + 100,
    },
    timestamp: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------------ */
/*  GET /api/mock/agent — health check                                 */
/* ------------------------------------------------------------------ */
export async function GET() {
  return NextResponse.json({ status: 'ok', agent: 'mock-agent', version: '1.0.0' });
}
