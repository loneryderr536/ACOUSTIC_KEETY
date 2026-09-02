import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod/v4';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { generateApiKey } from '@/lib/apikeys';

const providerRegisterSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8).optional(),
});

/* ------------------------------------------------------------------ */
/*  POST /api/providers/register — provider registration               */
/* ------------------------------------------------------------------ */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = providerRegisterSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { email, name, password } = parsed.data;

    // Check for existing user
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      // If already a provider or admin, conflict
      if (existingUser.role === 'provider' || existingUser.role === 'admin') {
        return NextResponse.json(
          { error: 'This email is already registered as a provider' },
          { status: 409 },
        );
      }

      // Upgrade subscriber to provider
      const apiKey = generateApiKey();
      const updated = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          role: 'provider',
          name: name || existingUser.name,
          apiKey,
        },
      });

      return NextResponse.json(
        {
          id: updated.id,
          apiKey,
          message: 'Account upgraded from subscriber to provider.',
        },
        { status: 201 },
      );
    }

    // Create new provider
    const apiKey = generateApiKey();

    const hashedPassword = password ? await bcrypt.hash(password, 12) : null;
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: hashedPassword,
        role: 'provider',
        apiKey,
      },
    });

    return NextResponse.json(
      {
        id: user.id,
        apiKey,
        message: 'Provider account created successfully.',
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/providers/register]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
