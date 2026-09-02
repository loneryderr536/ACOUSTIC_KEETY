import { prisma } from '../prisma';
import { classifyMessage } from './classifier';
import { getSession, setSession, deleteSession, getSessionWeight } from './sessions';
import { getPlanConfig, getCallWeight } from '../plans';

interface GatewayRequest {
  userId: string;
  platform: string;
  text: string;
}

interface GatewayResponse {
  text: string;
  buttons?: Array<Array<{ text: string; callback_data: string }>>;
}

export async function handleMessage(req: GatewayRequest): Promise<GatewayResponse> {
  const { userId, platform, text } = req;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { text: 'Account not found. Please re-link at acoustickitty.ai/link' };

  const config = getPlanConfig(user.plan);
  if (!config.messagingEnabled) {
    return { text: 'Messaging is available on paid plans. Upgrade at acoustickitty.ai/pricing' };
  }

  // Commands
  if (text === '/done' || text === '/switch') {
    const session = await getSession(userId, platform);
    await deleteSession(userId, platform);
    if (text === '/done') {
      const used = session ? session.turnCount : 0;
      return { text: `Session ended. ${used} turns used. ${user.callsBalance} calls remaining.\n\nWhat else can I help with?` };
    }
    // /switch falls through to classification
  }

  if (text === '/status') {
    const session = await getSession(userId, platform);
    const sessionInfo = session
      ? `Active: ${session.agentName} (turn ${session.turnCount})`
      : 'No active session';
    return { text: `*${config.label}* plan\nBalance: ${user.callsBalance} calls\n${sessionInfo}` };
  }

  if (text === '/help') {
    return {
      text: '*Commands:*\n/done — end session\n/switch — change agent\n/status — plan & balance\n/agents — browse agents\n/help — this message',
    };
  }

  if (text === '/agents') {
    const agents = await prisma.agent.findMany({
      where: { status: 'active' },
      orderBy: { currentScore: 'desc' },
      take: 5,
    });
    if (agents.length === 0) return { text: 'No agents available yet.' };
    const list = agents
      .map((a, i) => `${i + 1}. *${a.name}* (${a.rating ? `★${a.rating.toFixed(1)}` : 'new'}) — ${a.shortDesc || a.description.slice(0, 60)}`)
      .join('\n');
    return {
      text: `*Top agents:*\n\n${list}`,
      buttons: [agents.map((a, i) => ({ text: `${i + 1}`, callback_data: `connect:${a.slug}` }))],
    };
  }

  // Active session — forward to agent
  const session = await getSession(userId, platform);

  if (session) {
    const sessionWeight = getSessionWeight(session.turnCount + 1);
    const agent = await prisma.agent.findUnique({ where: { id: session.agentId } });

    if (!agent) {
      await deleteSession(userId, platform);
      return { text: 'Agent no longer available. Session ended.' };
    }

    const callWeight = getCallWeight(agent.modelTier ?? 'unknown');
    const totalWeight = sessionWeight * callWeight;

    if (user.callsBalance < totalWeight) {
      return {
        text: `Not enough calls. This message costs ${totalWeight} call${totalWeight > 1 ? 's' : ''} but you have ${user.callsBalance}. /done to end session.`,
      };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { callsBalance: { decrement: totalWeight }, callsUsed: { increment: totalWeight } },
    });

    try {
      const proxyRes = await fetch(`${agent.endpointUrl.replace(/\/+$/, '')}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: text,
          context: { history: session.history.slice(-10) },
          session_id: `ak_sess_${userId}_${platform}`,
        }),
      });

      const result = await proxyRes.json();
      const output = result.output ?? 'No response from agent.';

      session.turnCount++;
      session.history.push({ role: 'user', content: text });
      session.history.push({ role: 'agent', content: output.slice(0, 2000) });
      await setSession(userId, platform, session);

      const nextSessionWeight = getSessionWeight(session.turnCount + 1);
      const nextTotalWeight = nextSessionWeight * callWeight;
      const footer = `\n\n_${session.agentName} · turn ${session.turnCount} · ${nextTotalWeight} call${nextTotalWeight > 1 ? 's' : ''}/msg · ${user.callsBalance - totalWeight} remaining_`;

      return { text: output + footer };
    } catch {
      return { text: 'Agent failed to respond. Try again or /done to end session.' };
    }
  }

  // No session — classify and recommend
  const classification = await classifyMessage(text);

  if (classification.category === 'unclear' || classification.confidence < 0.7) {
    return {
      text: "I'm not sure which type of agent you need. What are you looking for?",
      buttons: [
        [
          { text: 'Document Analysis', callback_data: 'cat:document-analysis' },
          { text: 'Legal', callback_data: 'cat:legal' },
        ],
        [
          { text: 'Code Review', callback_data: 'cat:code-review' },
          { text: 'Creative', callback_data: 'cat:creative' },
        ],
        [
          { text: 'Research', callback_data: 'cat:research' },
          { text: 'Dev Tools', callback_data: 'cat:dev-tools' },
        ],
        [
          { text: 'Support', callback_data: 'cat:customer-support' },
          { text: 'Sales', callback_data: 'cat:sales-automation' },
        ],
      ],
    };
  }

  const topAgent = await prisma.agent.findFirst({
    where: { category: classification.category, status: 'active' },
    orderBy: { currentScore: 'desc' },
  });

  if (!topAgent) {
    return { text: `No agents available in ${classification.category}. Try a different category.` };
  }

  const ratingStr = topAgent.rating ? `★${topAgent.rating.toFixed(1)}` : 'new';

  return {
    text: `I'd recommend *${topAgent.name}* (${ratingStr}) — top-rated in ${classification.category}.`,
    buttons: [
      [
        { text: 'Connect', callback_data: `connect:${topAgent.slug}` },
        { text: 'Alternatives', callback_data: `alts:${classification.category}` },
        { text: 'Cancel', callback_data: 'cancel' },
      ],
    ],
  };
}

export async function handleCallback(userId: string, platform: string, data: string): Promise<GatewayResponse> {
  if (data === 'cancel') {
    return { text: 'Cancelled. Send me a message when you need help.' };
  }

  if (data.startsWith('connect:')) {
    const slug = data.replace('connect:', '');
    const agent = await prisma.agent.findUnique({ where: { slug } });
    if (!agent) return { text: 'Agent not found.' };

    await setSession(userId, platform, {
      agentSlug: agent.slug,
      agentId: agent.id,
      agentName: agent.name,
      turnCount: 0,
      startedAt: Date.now(),
      history: [],
    });

    return {
      text: `Connected to *${agent.name}*. Send your message.\n\n_/done to end · /switch to change agent_`,
    };
  }

  if (data.startsWith('alts:') || data.startsWith('cat:')) {
    const category = data.replace(/^(alts|cat):/, '');
    const agents = await prisma.agent.findMany({
      where: { category, status: 'active' },
      orderBy: { currentScore: 'desc' },
      take: 3,
    });

    if (agents.length === 0) return { text: 'No agents available in this category.' };

    const list = agents
      .map(
        (a, i) =>
          `${i + 1}. *${a.name}* (${a.rating ? `★${a.rating.toFixed(1)}` : 'new'}) — ${a.shortDesc || a.description.slice(0, 60)}`
      )
      .join('\n');

    return {
      text: `Available agents:\n\n${list}`,
      buttons: [agents.map((a, i) => ({ text: `${i + 1}`, callback_data: `connect:${a.slug}` }))],
    };
  }

  return { text: 'Unknown action.' };
}
