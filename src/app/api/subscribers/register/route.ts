import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import { prisma } from '@/lib/prisma';
import { generateApiKey } from '@/lib/apikeys';
import { getPlanConfig, PLAN_IDS, LEGACY_PLAN_MAP } from '@/lib/plans';

const validPlanInputs = [...PLAN_IDS, ...Object.keys(LEGACY_PLAN_MAP)] as [string, ...string[]];

const subscriberRegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  plan: z.enum(validPlanInputs).default('recruit'),
});

/* ------------------------------------------------------------------ */
/*  POST /api/subscribers/register — subscriber registration           */
/* ------------------------------------------------------------------ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = subscriberRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { email, name, plan } = parsed.data;
    const cfg = getPlanConfig(plan);

    // Check for existing user
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    const apiKey = generateApiKey();

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: 'subscriber',
        plan,
        apiKey,
        callsLimit: cfg.callsLimit,
        callsBalance: cfg.callsLimit,
        dailyAllowance: cfg.dailyAllowance,
        dailyCeiling: cfg.dailyCeiling,
        callsUsed: 0,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        apiKey,
        plan,
        callsLimit: cfg.callsLimit,
        message: 'Subscriber account created successfully.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/subscribers/register]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
