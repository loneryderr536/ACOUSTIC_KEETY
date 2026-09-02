import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generateApiKey } from '@/lib/apikeys';
import { getPlanConfig } from '@/lib/plans';

interface GoogleTokenInfo {
  sub: string;
  email: string;
  email_verified: string;
  name: string;
  picture: string;
  aud: string;
}

export async function POST(request: NextRequest) {
  try {
    const { credential } = await request.json();
    if (!credential) {
      return NextResponse.json({ error: 'Missing credential' }, { status: 400 });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (!clientId) {
      return NextResponse.json({ error: 'Google sign-in not configured' }, { status: 503 });
    }

    // Verify the Google ID token via Google's tokeninfo endpoint
    const tokenRes = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,
    );
    if (!tokenRes.ok) {
      return NextResponse.json({ error: 'Invalid Google credential' }, { status: 401 });
    }

    const tokenInfo: GoogleTokenInfo = await tokenRes.json();

    // Verify the token was issued for our app
    if (tokenInfo.aud !== clientId) {
      console.error('[Google Auth] aud mismatch:', JSON.stringify({ aud: tokenInfo.aud, clientId }));
      return NextResponse.json({ error: 'Token audience mismatch' }, { status: 401 });
    }

    if (tokenInfo.email_verified !== 'true') {
      return NextResponse.json({ error: 'Email not verified with Google' }, { status: 401 });
    }

    const googleId = tokenInfo.sub;
    const email = tokenInfo.email;
    const name = tokenInfo.name || email.split('@')[0];

    // Find existing user by googleId or email
    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    let isNew = false;

    if (user) {
      // Link Google ID if not already set
      if (!user.googleId) {
        await prisma.user.update({
          where: { id: user.id },
          data: { googleId },
        });
      }
      // Ensure user has an API key (could have been created via provider flow without one)
      if (!user.apiKey) {
        const apiKey = generateApiKey();
        await prisma.user.update({
          where: { id: user.id },
          data: { apiKey },
        });
        user = { ...user, apiKey };
      }
    } else {
      // Create new subscriber
      const apiKey = generateApiKey();
      const recruitCfg = getPlanConfig('recruit');
      user = await prisma.user.create({
        data: {
          email,
          name,
          googleId,
          role: 'subscriber',
          plan: 'recruit',
          apiKey,
          callsLimit: recruitCfg.callsLimit,
          callsBalance: recruitCfg.callsLimit,
          dailyAllowance: recruitCfg.dailyAllowance,
          dailyCeiling: recruitCfg.dailyCeiling,
          callsUsed: 0,
        },
      });
      isNew = true;
    }

    return NextResponse.json({
      apiKey: user.apiKey,
      name: user.name || name,
      plan: user.plan,
      isNew,
    });
  } catch (error) {
    console.error('[POST /api/auth/google]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
