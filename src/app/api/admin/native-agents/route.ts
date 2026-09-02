import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getOrCreatePlatformUser } from '@/lib/platform';
import { CATEGORIES } from '@/lib/validation';
import slugify from 'slugify';

/**
 * Native agents — the ones the marketplace hosts itself.
 *
 * Third-party listings come in through POST /api/agents with provider auth and
 * go through benchmarking, endpoint validation and the deposit flow. None of
 * that applies to an agent the platform owns, so this is a separate admin path
 * rather than a flag bolted onto the public registration route.
 *
 * Why `native` matters beyond a badge: the monthly payout engine retains 100%
 * of the revenue attributable to native agents before the provider pool is even
 * sized, and excludes them from the per-provider split entirely. Marking an
 * agent native is a revenue decision, not a cosmetic one — which is exactly why
 * it sits behind the admin secret.
 *
 * Auth: `x-admin-secret: <BENCHMARK_CRON_SECRET>`, matching the other admin routes.
 */

function authorized(request: NextRequest): boolean {
  const secret = request.headers.get('x-admin-secret');
  return Boolean(process.env.BENCHMARK_CRON_SECRET) && secret === process.env.BENCHMARK_CRON_SECRET;
}

/** GET — list every native agent, plus the platform user id to put in PLATFORM_USER_ID. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const platform = await getOrCreatePlatformUser();
  const agents = await prisma.agent.findMany({
    where: { native: true },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, slug: true, name: true, category: true, status: true,
      native: true, providerId: true, currentScore: true, totalCalls: true,
    },
  });

  return NextResponse.json({
    platformUserId: platform.id,
    platformEmail: platform.email,
    count: agents.length,
    agents,
  });
}

/**
 * POST — create a native agent, or flip existing agents to/from native.
 *
 *   { "action": "create", "name": "...", "category": "...", "endpointUrl": "...", ... }
 *   { "action": "mark", "slugs": ["gimmick"], "native": true }
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body must be JSON' }, { status: 400 });
  }

  const action = body.action ?? 'create';

  // ── flip existing agents ────────────────────────────────────────────────
  if (action === 'mark') {
    const slugs = body.slugs;
    if (!Array.isArray(slugs) || slugs.length === 0) {
      return NextResponse.json({ error: 'slugs must be a non-empty array' }, { status: 400 });
    }
    const native = body.native !== false;

    // Marking a third-party agent native would silently stop paying its
    // provider, so reassign ownership to the platform at the same time and say
    // so in the response. Un-marking does NOT hand it back — that needs a
    // deliberate providerId, which this route does not guess at.
    const platform = await getOrCreatePlatformUser();
    const result = await prisma.agent.updateMany({
      where: { slug: { in: slugs as string[] } },
      data: native ? { native: true, providerId: platform.id } : { native: false },
    });

    return NextResponse.json({
      updated: result.count,
      native,
      ...(native
        ? { note: `Ownership reassigned to the platform user (${platform.id}). These agents no longer earn provider payouts.` }
        : { note: 'Agents un-marked as native. They are still owned by the platform user — set providerId explicitly to hand one back to a third party.' }),
    });
  }

  // ── create a new native agent ───────────────────────────────────────────
  if (action !== 'create') {
    return NextResponse.json({ error: `Unknown action "${String(action)}"` }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const category = typeof body.category === 'string' ? body.category : '';
  const endpointUrl = typeof body.endpointUrl === 'string' ? body.endpointUrl.trim() : '';

  if (!name || !category || !endpointUrl) {
    return NextResponse.json(
      { error: 'name, category and endpointUrl are required' },
      { status: 400 },
    );
  }
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    return NextResponse.json(
      { error: `Invalid category. One of: ${(CATEGORIES as readonly string[]).join(', ')}` },
      { status: 400 },
    );
  }

  const slug = typeof body.slug === 'string' && body.slug
    ? slugify(body.slug, { lower: true, strict: true })
    : slugify(name, { lower: true, strict: true });

  const existing = await prisma.agent.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ error: `An agent with slug "${slug}" already exists` }, { status: 409 });
  }

  const platform = await getOrCreatePlatformUser();
  const description = typeof body.description === 'string' ? body.description : `${name}, hosted by ${platform.name}.`;

  const agent = await prisma.agent.create({
    data: {
      slug,
      name,
      description,
      shortDesc: description.slice(0, 200),
      category,
      tags: Array.isArray(body.tags) ? (body.tags as string[]).slice(0, 8) : [],
      providerId: platform.id,
      native: true,
      endpointUrl,
      connectorType: typeof body.connectorType === 'string' ? body.connectorType : 'api',
      authType: 'none',
      pricingModel: typeof body.pricingModel === 'string' ? body.pricingModel : 'platform',
      pricePerCall: typeof body.pricePerCall === 'number' ? body.pricePerCall : 20,
      modelTier: typeof body.modelTier === 'string' ? body.modelTier : 'haiku',
      // Native agents skip the benchmarking queue — the platform vouches for
      // its own. Pass {"status": "pending"} to put one through anyway.
      status: typeof body.status === 'string' ? body.status : 'active',
    },
  });

  return NextResponse.json(
    {
      agent: { id: agent.id, slug: agent.slug, name: agent.name, native: agent.native, status: agent.status },
      platformUserId: platform.id,
      note: 'Native — revenue from this agent is retained in full and never enters the provider payout pool.',
    },
    { status: 201 },
  );
}
