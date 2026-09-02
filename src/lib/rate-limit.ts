import { getRedisClient } from './redis';
import { getPlanConfig } from './plans';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  retryAfter?: number;
}

/**
 * Per-minute burst rate limit using Redis INCR + EXPIRE.
 */
export async function checkBurstLimit(userId: string, plan: string): Promise<RateLimitResult> {
  const redis = getRedisClient();
  if (!redis) {
    // Redis unavailable — fail open
    return { allowed: true, remaining: 999, limit: 999 };
  }

  const config = getPlanConfig(plan);
  const minute = Math.floor(Date.now() / 60000);
  const key = `burst:${userId}:${minute}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, 120);
  }

  if (current > config.burstPerMinute) {
    const retryAfter = 60 - (Math.floor(Date.now() / 1000) % 60);
    return { allowed: false, remaining: 0, limit: config.burstPerMinute, retryAfter };
  }

  return { allowed: true, remaining: config.burstPerMinute - current, limit: config.burstPerMinute };
}

/**
 * Per-agent concurrency limit.
 */
export async function checkConcurrency(userId: string, agentId: string, plan: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return true;

  const config = getPlanConfig(plan);
  const key = `concurrent:${userId}:${agentId}`;

  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, 60);
  }

  if (current > config.concurrentPerAgent) {
    await redis.decr(key);
    return false;
  }

  return true;
}

export async function releaseConcurrency(userId: string, agentId: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  const key = `concurrent:${userId}:${agentId}`;
  await redis.decr(key);
}
