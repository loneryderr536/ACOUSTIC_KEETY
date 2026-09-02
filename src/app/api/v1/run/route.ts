import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runAgentSchema } from '@/lib/validation';
import { resolveAgent, proxyToAgent } from '@/lib/router';
import { withSecurityScan, withResponseSanitization } from '@/lib/middleware/securityMiddleware';
import { resolveUser } from '@/lib/auth';
import { validateEndpointUrl } from '@/lib/security';
import { checkBurstLimit } from '@/lib/rate-limit';
import { getCallWeight } from '@/lib/plans';

export async function POST(request: NextRequest) {
  try {
    // Authenticate subscriber (accepts both API key and JWT)
    const subscriber = await resolveUser(request.headers.get('authorization'));
    if (!subscriber) {
      return NextResponse.json(
        { error: 'Missing or invalid Authorization header' },
        { status: 401 },
      );
    }

    // Validate body
    const body = await request.json();
    const parsed = runAgentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { task, category, agent: agentSlug, input, routing } = parsed.data;

    // Security scan on input payload
    const securityCheck = withSecurityScan({ task, input });
    if (securityCheck.blocked) {
      return NextResponse.json(
        {
          error: 'Request blocked by security scan',
          riskScore: securityCheck.riskScore,
          findings: securityCheck.findings.map(f => f.description),
        },
        { status: 403 },
      );
    }

    // Resolve the best agent (before rate-limit so we know the call weight)
    let resolved;
    try {
      resolved = await resolveAgent({
        agent: agentSlug,
        category,
        routing: routing || 'performance',
        subscriberPlan: subscriber.plan,
      });
    } catch (err) {
      console.error('[resolveAgent]', err);
      const message = err instanceof Error ? err.message : 'No suitable agent found for this request';
      // Plan-tier restrictions are a 403 ("you can't access this"),
      // not a 404 ("no such thing"). Everything else stays 404.
      const isPlanRestriction =
        message.startsWith("Your plan doesn't include") ||
        message.startsWith('No agents available on your plan tier');
      return NextResponse.json(
        { error: message },
        { status: isPlanRestriction ? 403 : 404 },
      );
    }

    const callWeight = getCallWeight(resolved.modelTier ?? 'unknown');

    // Burst rate limit (Redis per-minute check)
    const burstCheck = await checkBurstLimit(subscriber.id, subscriber.plan);
    if (!burstCheck.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: burstCheck.retryAfter },
        { status: 429, headers: { 'Retry-After': String(burstCheck.retryAfter ?? 60) } },
      );
    }

    // Atomic rate limit: decrement balance by call weight, increment used
    const rateCheck = await prisma.user.updateMany({
      where: { id: subscriber.id, callsBalance: { gte: callWeight } },
      data: { callsBalance: { decrement: callWeight }, callsUsed: { increment: callWeight } },
    });
    if (rateCheck.count === 0) {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          callWeight,
          callsBalance: subscriber.callsBalance,
        },
        { status: 429 },
      );
    }

    // Proxy to the resolved agent
    const payload = { task, input };
    let result = await proxyToAgent(
      resolved.endpointUrl,
      resolved.authType,
      resolved.authToken,
      payload,
      resolved.id,
    );

    let usedAgentId = resolved.id;
    let usedAgentSlug = resolved.slug;
    let usedAgentName = resolved.name;
    let usedPricePerCall = resolved.pricePerCall;
    let usedModelTier = resolved.modelTier;

    // If failure, try fallbacks in order
    if (result.status !== 'success' && resolved.fallbackAgentIds.length > 0) {
      for (const fallbackId of resolved.fallbackAgentIds) {
        const fallbackAgent = await prisma.agent.findUnique({
          where: { id: fallbackId },
        });
        if (!fallbackAgent) continue;

        result = await proxyToAgent(
          fallbackAgent.endpointUrl,
          fallbackAgent.authType,
          fallbackAgent.authToken,
          payload,
          fallbackAgent.id,
        );

        if (result.status === 'success') {
          usedAgentId = fallbackAgent.id;
          usedAgentSlug = fallbackAgent.slug;
          usedAgentName = fallbackAgent.name;
          usedPricePerCall = fallbackAgent.pricePerCall;
          usedModelTier = fallbackAgent.modelTier ?? 'unknown';
          break;
        }
      }
    }

    // If every attempt (primary + fallbacks) failed, refund the subscriber's
    // balance — they paid for a result they did not get — and do not credit
    // the provider either. We still log the failed call for telemetry.
    const allAttemptsFailed = result.status !== 'success';
    if (allAttemptsFailed) {
      await prisma.user.update({
        where: { id: subscriber.id },
        data: {
          callsBalance: { increment: callWeight },
          callsUsed: { decrement: callWeight },
        },
      });
    }

    // costCents is legacy — kept for backwards compat on historical rows.
    // Authoritative payout math uses creditsConsumed, snapshotted from
    // the model tier of the agent that ACTUALLY served the call (not the
    // primary, in case a fallback handled it). Later tier changes on the
    // agent won't retroactively reprice this call.
    const costCents = allAttemptsFailed ? 0 : usedPricePerCall;
    const creditsConsumed = allAttemptsFailed
      ? 0
      : getCallWeight(usedModelTier ?? 'unknown');

    // Log the API call
    const apiCall = await prisma.apiCall.create({
      data: {
        subscriberId: subscriber.id,
        agentId: usedAgentId,
        routingStrategy: routing || 'performance',
        latencyMs: result.latencyMs,
        status: result.status,
        requestSize: JSON.stringify(body).length,
        responseSize: JSON.stringify(result.data ?? '').length,
        costCents,
        creditsConsumed,
      },
    });

    // Only credit the provider's agent counter on success.
    if (!allAttemptsFailed) {
      await prisma.agent.update({
        where: { id: usedAgentId },
        data: { totalCalls: { increment: 1 } },
      });
    }

    // Sanitize agent response before returning
    const sanitized = withResponseSanitization(result.data);

    // Callback support (with SSRF validation)
    if (parsed.data.callback_url) {
      const cbValid = validateEndpointUrl(parsed.data.callback_url);
      if (cbValid.safe) {
        fetch(parsed.data.callback_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_id: apiCall.callId, agent: usedAgentSlug, result: sanitized.data, status: result.status }),
        }).catch((err) => console.error('[callback] Failed:', parsed.data.callback_url, err));
      } else {
        console.warn('[callback] Blocked unsafe URL:', parsed.data.callback_url, cbValid.reason);
      }
    }

    // Usage headers — expose only what subscribers need, not internal plan details
    const balanceRemaining = Math.max(0, subscriber.callsBalance - callWeight);
    const rateLimitHeaders: Record<string, string> = {
      'X-RateLimit-Remaining': String(balanceRemaining),
      'X-Call-Weight': String(callWeight),
    };
    if (balanceRemaining < subscriber.callsLimit * 0.2) {
      rateLimitHeaders['X-Usage-Warning'] = balanceRemaining < subscriber.callsLimit * 0.05 ? 'critical' : 'approaching-limit';
    }

    return NextResponse.json({
      call_id: apiCall.callId,
      agent: usedAgentSlug,
      agent_name: usedAgentName,
      routing_strategy: routing || 'performance',
      result: sanitized.data,
      latency_ms: result.latencyMs,
      status: result.status,
      cost_cents: costCents,
    }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('[POST /api/v1/run]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
