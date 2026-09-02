import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/* ------------------------------------------------------------------ */
/*  GET /api/agents/:slug/card.json — A2A-compatible agent card        */
/* ------------------------------------------------------------------ */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;

    const agent = await prisma.agent.findUnique({
      where: { slug },
      include: { provider: { select: { name: true } } },
    });

    if (!agent || agent.status === 'suspended') {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const skills = (agent.skillsData as Array<{
      id: string;
      name: string;
      description: string;
    }>) ?? [
      {
        id: 'default',
        name: agent.name,
        description: agent.shortDesc || agent.description.slice(0, 200),
      },
    ];

    // Redact internal details: endpoint URLs, auth schemes, and provider emails
    // are not exposed publicly to prevent reverse engineering
    const card = {
      name: agent.name,
      description: agent.description,
      version: '1.0.0',
      url: `https://acoustickitty.ai/api/v1/run`,
      provider: {
        organization: agent.provider.name ?? 'Unknown',
      },
      capabilities: {
        streaming: false,
        pushNotifications: false,
        multiTurn: false,
      },
      skills: skills.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      })),
      authentication: {
        schemes: ['bearer'],
      },
      protocolVersion: '0.2.1',
      platformUrl: `https://acoustickitty.ai/agents/${agent.slug}`,
      badges: agent.hasAgentCard ? ['a2a-compatible'] : [],
    };

    return NextResponse.json(card, {
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('[GET /api/agents/:slug/card.json]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
