import { ImageResponse } from '@vercel/og';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const agent = await prisma.agent.findUnique({
    where: { slug },
    select: {
      name: true,
      shortDesc: true,
      category: true,
      currentScore: true,
      currentRank: true,
      latencyP50: true,
      provider: { select: { name: true } },
    },
  });

  if (!agent) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            backgroundColor: '#09090b',
            color: '#f4f4f5',
            fontSize: 48,
            fontWeight: 700,
          }}
        >
          AgentVault
        </div>
      ),
      { width: 1200, height: 630 }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '100%',
          height: '100%',
          backgroundColor: '#09090b',
          color: '#f4f4f5',
          padding: 60,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #f59e0b, #ea580c)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
            }}
          >
            ⚡
          </div>
          <span style={{ fontSize: 24, color: '#a1a1aa' }}>AgentVault</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.1 }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 24, color: '#a1a1aa', maxWidth: 800 }}>
            {agent.shortDesc}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 40 }}>
          {agent.currentScore && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 16, color: '#a1a1aa' }}>Score</span>
              <span style={{ fontSize: 36, fontWeight: 700, color: '#f59e0b' }}>
                {agent.currentScore}
              </span>
            </div>
          )}
          {agent.currentRank && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 16, color: '#a1a1aa' }}>Rank</span>
              <span style={{ fontSize: 36, fontWeight: 700 }}>
                #{agent.currentRank}
              </span>
            </div>
          )}
          {agent.latencyP50 && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 16, color: '#a1a1aa' }}>Latency</span>
              <span style={{ fontSize: 36, fontWeight: 700 }}>
                {agent.latencyP50}ms
              </span>
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 16, color: '#a1a1aa' }}>Category</span>
            <span style={{ fontSize: 36, fontWeight: 700 }}>
              {agent.category}
            </span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
