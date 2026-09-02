import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { registerAgentSchema, CATEGORIES } from '@/lib/validation';
import { validateEndpointUrl, scanInput } from '@/lib/security';
import { validateAgentEndpoints } from '@/lib/agent-validation';
import { encrypt } from '@/lib/crypto';
import slugify from 'slugify';
import { nanoid } from 'nanoid';

/* ------------------------------------------------------------------ */
/*  GET /api/agents — public agent listing with filters                */
/* ------------------------------------------------------------------ */
export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl;
    const category = url.searchParams.get('category') ?? undefined;
    const status = url.searchParams.get('status') ?? 'active';
    const sort = url.searchParams.get('sort') ?? 'score';
    const q = url.searchParams.get('q') ?? undefined;
    const limit = Math.min(Number(url.searchParams.get('limit') ?? 20), 100);
    const offset = Number(url.searchParams.get('offset') ?? 0);

    // Build where clause
    const where: Record<string, unknown> = { status };
    if (category && (CATEGORIES as readonly string[]).includes(category)) {
      where.category = category;
    }

    if (q) {
      // Full-text search: GIN index on searchVector accelerates these queries.
      // Individual search terms are matched against tags for better discovery.
      const searchTerms = q.trim().split(/\s+/).filter(Boolean);
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { shortDesc: { contains: q, mode: 'insensitive' } },
        { tags: { hasSome: searchTerms } },
      ];
    }

    // Build orderBy
    let orderBy: Record<string, string>;
    switch (sort) {
      case 'latency':
        orderBy = { latencyP50: 'asc' };
        break;
      case 'trending':
        orderBy = { trendDelta: 'desc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'score':
      default:
        orderBy = { currentScore: 'desc' };
        break;
    }

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          provider: { select: { name: true } },
        },
      }),
      prisma.agent.count({ where }),
    ]);

    // Strip internal fields before returning to clients
    const publicAgents = agents.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      shortDesc: a.shortDesc,
      category: a.category,
      tags: a.tags,
      provider: { name: a.provider.name },
      currentScore: a.currentScore,
      latencyP50: a.latencyP50,
      uptime: a.uptime,
      errorRate: a.errorRate,
      currentRank: a.currentRank,
      trendDelta: a.trendDelta,
      totalCalls: a.totalCalls,
      rating: a.rating,
      reviewCount: a.reviewCount,
      status: a.status,
      pricePerCall: a.pricePerCall,
      modelTier: a.modelTier,
      logoUrl: a.logoUrl,
      docsUrl: a.docsUrl,
      createdAt: a.createdAt,
      // endpointUrl, authType, authToken, repoUrl, connectorType — intentionally omitted
    }));

    return NextResponse.json(
      { agents: publicAgents, total, limit, offset },
      { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300' } },
    );
  } catch (error) {
    console.error('[GET /api/agents]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST /api/agents — register new agent (provider auth required)     */
/* ------------------------------------------------------------------ */
export async function POST(request: NextRequest) {
  try {
    // Authenticate via Bearer token
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
        { error: 'Only providers can register agents' },
        { status: 403 },
      );
    }

    // Validate body
    const body = await request.json();
    const parsed = registerAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // SSRF protection — validate endpoint URL
    const urlCheck = validateEndpointUrl(data.endpointUrl);
    if (!urlCheck.safe) {
      return NextResponse.json({ error: urlCheck.reason }, { status: 422 });
    }

    // Security scan on registration content
    const regScan = scanInput({ name: data.name, description: data.description, tags: data.tags });
    if (regScan.riskScore >= 40) {
      return NextResponse.json(
        { error: 'Registration content flagged by security scan', findings: regScan.findings.map(f => f.description) },
        { status: 422 },
      );
    }

    // Unique name check
    const existingName = await prisma.agent.findFirst({ where: { name: data.name } });
    if (existingName) {
      return NextResponse.json(
        { error: 'An agent with this name already exists. Choose a unique name.' },
        { status: 409 },
      );
    }

    // Level 2 endpoint validation
    const validation = await validateAgentEndpoints(data.endpointUrl);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Agent endpoint validation failed', details: validation.errors, ...validation },
        { status: 422 },
      );
    }

    // Generate a unique slug
    let slug = slugify(data.name, { lower: true, strict: true });
    const existing = await prisma.agent.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${nanoid(4)}`;
    }

    // Every new agent lists at Haiku tier regardless of what the provider
    // declared. Standard and Premium tiers pay 3× / 10× on payouts, so
    // self-declaration is a fraud vector. Admins upgrade tier after
    // verifying the agent's model signature (see /reference#provider-contract).
    const declaredTier = data.modelTier ?? 'haiku';
    const storedTier = 'haiku';
    const tierPendingReview = declaredTier !== 'haiku';

    // Create agent
    const agent = await prisma.agent.create({
      data: {
        slug,
        name: data.name,
        description: data.description,
        shortDesc: data.shortDesc ?? '',
        category: data.category,
        tags: data.tags ?? [],
        endpointUrl: data.endpointUrl,
        connectorType: data.connectorType ?? 'api',
        authType: data.authType ?? 'none',
        authToken: data.authToken ? encrypt(data.authToken) : null,
        pricingModel: data.pricingModel ?? 'usage',
        pricePerCall: data.pricePerCall ?? 20,
        modelTier: storedTier,
        logoUrl: data.logoUrl,
        docsUrl: data.docsUrl,
        repoUrl: data.repoUrl,
        mcpServerUrl: data.mcpServerUrl,
        hasAgentCard: validation.agentCardFound,
        skillsData: validation.skills.length > 0 ? validation.skills : undefined,
        status: 'pending',
        providerId: user.id,
      },
    });

    const tierNote = tierPendingReview
      ? ` Requested tier "${declaredTier}" is pending admin review — agent listed at Haiku tier until verified.`
      : '';

    return NextResponse.json(
      {
        agent: {
          id: agent.id,
          slug: agent.slug,
          status: agent.status,
          modelTier: agent.modelTier,
          tierPendingReview,
          declaredTier,
        },
        message: `Agent registered. It will be benchmarked before going live.${tierNote}`,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/agents]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
