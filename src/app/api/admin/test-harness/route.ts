import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCallWeight } from '@/lib/plans';

/**
 * POST /api/admin/test-harness
 *
 * DISPOSABLE QA helper. Admin-gated. Used to simulate end-to-end payment
 * pipeline flows without actually invoking LLMs or waiting for organic
 * traffic.
 *
 * Actions (send `{ "action": "..." }`):
 *
 *   - "seed-calls": creates N synthetic successful ApiCall rows for a
 *     given provider's agent. Args: providerApiKey, count, costCents.
 *     Idempotent insofar as each call creates a new row.
 *
 *   - "attach-stripe": overrides a provider's stripeAccountId for testing
 *     payout dispatch. Args: providerApiKey, stripeAccountId.
 *
 *   - "activate-agent": force-activate an agent by slug so subscribers
 *     can call it in live tests. Args: slug.
 *
 *   - "purge": delete all synthetic QA users + their calls + payouts.
 *     Args: emailPrefix (defaults "qa-").
 *
 * REMOVE THIS ROUTE before public launch. It can mint arbitrary earnings.
 */
export async function POST(request: NextRequest) {
  const secret = request.headers.get('x-admin-secret');
  if (!process.env.BENCHMARK_CRON_SECRET || secret !== process.env.BENCHMARK_CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = body.action as string | undefined;

  if (action === 'seed-calls') {
    const { providerApiKey, count, costCents } = body;
    if (!providerApiKey || typeof count !== 'number' || count <= 0) {
      return NextResponse.json(
        { error: 'Need providerApiKey and count>0' },
        { status: 400 },
      );
    }
    const provider = await prisma.user.findUnique({ where: { apiKey: providerApiKey } });
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

    const agent = await prisma.agent.findFirst({ where: { providerId: provider.id } });
    if (!agent) return NextResponse.json({ error: 'Provider has no agent' }, { status: 400 });

    // Find any subscriber to attribute the calls to (synthetic)
    const subscriber = await prisma.user.findFirst({
      where: { role: 'subscriber' },
      orderBy: { createdAt: 'desc' },
    });
    if (!subscriber) {
      return NextResponse.json(
        { error: 'No subscriber exists to attribute calls to — create one first' },
        { status: 400 },
      );
    }

    const cents = typeof costCents === 'number' ? costCents : agent.pricePerCall;
    // Credits consumed snapshots from the agent's current model tier —
    // matches the live /api/v1/run path so payout math is identical.
    const creditsConsumed = getCallWeight(agent.modelTier ?? 'unknown');
    const rows = Array.from({ length: count }, () => ({
      subscriberId: subscriber.id,
      agentId: agent.id,
      routingStrategy: 'specific',
      latencyMs: 200 + Math.floor(Math.random() * 400),
      status: 'success',
      requestSize: 128,
      responseSize: 512,
      costCents: cents,
      creditsConsumed,
    }));

    const res = await prisma.apiCall.createMany({ data: rows });
    await prisma.agent.update({
      where: { id: agent.id },
      data: { totalCalls: { increment: res.count } },
    });

    return NextResponse.json({
      action,
      seeded: res.count,
      agentSlug: agent.slug,
      providerEmail: provider.email,
      modelTier: agent.modelTier,
      creditsPerCall: creditsConsumed,
      totalCreditsConsumed: res.count * creditsConsumed,
      grossCents: res.count * creditsConsumed, // 1 credit = 1 cent
      note: 'These rows count as real successful calls for payout purposes.',
    });
  }

  if (action === 'attach-stripe') {
    const { providerApiKey, stripeAccountId } = body;
    if (!providerApiKey || typeof stripeAccountId !== 'string') {
      return NextResponse.json(
        { error: 'Need providerApiKey and stripeAccountId' },
        { status: 400 },
      );
    }
    const updated = await prisma.user.updateMany({
      where: { apiKey: providerApiKey },
      data: { stripeAccountId },
    });
    return NextResponse.json({ action, updated: updated.count, stripeAccountId });
  }

  if (action === 'activate-agent') {
    const { slug } = body;
    if (!slug) return NextResponse.json({ error: 'Need slug' }, { status: 400 });
    const updated = await prisma.agent.updateMany({
      where: { slug },
      data: { status: 'active' },
    });
    return NextResponse.json({ action, updated: updated.count });
  }

  if (action === 'register-agent') {
    // Skip the endpoint-contract validator and add an agent directly.
    // Only for test-harness runs where we don't have a real hosted endpoint.
    const { providerApiKey, slug, name, category, pricePerCall, modelTier } = body;
    if (!providerApiKey || !slug || !name || !category) {
      return NextResponse.json({ error: 'Need providerApiKey, slug, name, category' }, { status: 400 });
    }
    const provider = await prisma.user.findUnique({ where: { apiKey: providerApiKey } });
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 });

    const agent = await prisma.agent.upsert({
      where: { slug },
      update: {},
      create: {
        slug,
        name,
        description: `QA synthetic agent: ${name}`,
        shortDesc: 'QA synthetic',
        category,
        tags: ['qa', 'synthetic'],
        providerId: provider.id,
        endpointUrl: 'https://example.invalid/tasks',
        status: 'active',
        pricePerCall: typeof pricePerCall === 'number' ? pricePerCall : 20,
        modelTier: modelTier || 'haiku',
      },
    });
    return NextResponse.json({ action, agent: { id: agent.id, slug: agent.slug, status: agent.status } });
  }

  if (action === 'purge') {
    const prefix = (body.emailPrefix as string) || 'qa-';
    const users = await prisma.user.findMany({
      where: { email: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    if (ids.length === 0) return NextResponse.json({ action, deleted: 0 });

    // delete in dependency order
    const agents = await prisma.agent.findMany({ where: { providerId: { in: ids } }, select: { id: true } });
    const agentIds = agents.map((a) => a.id);

    const delCalls1 = await prisma.apiCall.deleteMany({ where: { subscriberId: { in: ids } } });
    const delCalls2 = await prisma.apiCall.deleteMany({ where: { agentId: { in: agentIds } } });
    const delPayouts = await prisma.payout.deleteMany({ where: { providerId: { in: ids } } });
    const delBenchmarks = await prisma.benchmark.deleteMany({ where: { agentId: { in: agentIds } } });
    const delHealth = await prisma.healthCheck.deleteMany({ where: { agentId: { in: agentIds } } });
    const delReviews = await prisma.review.deleteMany({ where: { userId: { in: ids } } });
    const delLinks = await prisma.messagingLink.deleteMany({ where: { userId: { in: ids } } });
    const delAgents = await prisma.agent.deleteMany({ where: { providerId: { in: ids } } });
    const delSessions = await prisma.session.deleteMany({ where: { userId: { in: ids } } });
    const delUsers = await prisma.user.deleteMany({ where: { id: { in: ids } } });

    return NextResponse.json({
      action,
      prefix,
      deleted: {
        users: delUsers.count,
        agents: delAgents.count,
        apiCalls: delCalls1.count + delCalls2.count,
        payouts: delPayouts.count,
        benchmarks: delBenchmarks.count,
        healthChecks: delHealth.count,
        reviews: delReviews.count,
        messagingLinks: delLinks.count,
        sessions: delSessions.count,
      },
    });
  }

  return NextResponse.json(
    { error: 'Unknown action. Try: seed-calls, attach-stripe, activate-agent, register-agent, purge' },
    { status: 400 },
  );
}
