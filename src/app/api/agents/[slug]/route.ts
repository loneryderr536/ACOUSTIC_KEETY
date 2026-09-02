import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { updateAgentSchema } from '@/lib/validation';
import { leaderboard } from '@/lib/redis';

/* ------------------------------------------------------------------ */
/*  GET /api/agents/:slug — agent detail                               */
/* ------------------------------------------------------------------ */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const agent = await prisma.agent.findUnique({
      where: { slug },
      include: {
        provider: { select: { id: true, name: true } },
        benchmarks: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        reviews: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({ agent });
  } catch (error) {
    console.error('[GET /api/agents/:slug]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/*  PATCH /api/agents/:slug — update agent                             */
/* ------------------------------------------------------------------ */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 },
      );
    }

    const apiKey = authHeader.slice(7);
    const user = await prisma.user.findUnique({ where: { apiKey } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    if (user.role !== 'provider' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Only providers can update agents' },
        { status: 403 },
      );
    }

    const agent = await prisma.agent.findUnique({ where: { slug } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (agent.providerId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not own this agent' },
        { status: 403 },
      );
    }

    // Validate body
    const body = await request.json();
    const parsed = updateAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    // Strip pricePerCall — platform-set pricing only; providers cannot edit it
    const { pricePerCall: _strip, ...updateData } = parsed.data;

    const updated = await prisma.agent.update({
      where: { slug },
      data: updateData,
    });

    return NextResponse.json({ agent: updated });
  } catch (error) {
    console.error('[PATCH /api/agents/:slug]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/*  DELETE /api/agents/:slug — suspend agent                           */
/* ------------------------------------------------------------------ */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    // Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 },
      );
    }

    const apiKey = authHeader.slice(7);
    const user = await prisma.user.findUnique({ where: { apiKey } });
    if (!user) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
    }

    const agent = await prisma.agent.findUnique({ where: { slug } });
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    if (agent.providerId !== user.id && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'You do not own this agent' },
        { status: 403 },
      );
    }

    await prisma.agent.update({
      where: { slug },
      data: { status: 'suspended' },
    });

    // Remove from Redis leaderboard
    await leaderboard.remove(agent.category, agent.slug);

    return NextResponse.json({ success: true, message: `Agent "${slug}" suspended` });
  } catch (error) {
    console.error('[DELETE /api/agents/:slug]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
