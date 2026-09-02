import { getRedisClient } from '../redis';

export interface AgentSession {
  agentSlug: string;
  agentId: string;
  agentName: string;
  turnCount: number;
  startedAt: number;
  history: Array<{ role: 'user' | 'agent'; content: string }>;
}

const SESSION_TTL = 1800; // 30 minutes

export async function getSession(userId: string, platform: string): Promise<AgentSession | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  const data = await redis.get(`session:${userId}:${platform}`);
  return data ? JSON.parse(data) : null;
}

export async function setSession(userId: string, platform: string, session: AgentSession): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.set(`session:${userId}:${platform}`, JSON.stringify(session), 'EX', SESSION_TTL);
}

export async function deleteSession(userId: string, platform: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  await redis.del(`session:${userId}:${platform}`);
}

export function getSessionWeight(turnCount: number): number {
  if (turnCount <= 3) return 1;
  if (turnCount <= 7) return 2;
  if (turnCount <= 15) return 3;
  return 5;
}
