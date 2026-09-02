import Redis from 'ioredis';

/**
 * Redis is an accelerator here, not a source of truth — it holds leaderboard
 * sorted sets that are rebuilt from Postgres on every orchestrator cycle. So
 * the app must work without it, and a Redis outage must never take a request
 * down with it.
 *
 * The previous version handled REDIS_URL being *unset*, but not REDIS_URL being
 * set and unreachable — which is the normal state in local development, and a
 * plausible one in production during a cache restart. ioredis then retried
 * forever, emitting an unhandled `error` event each time. That produced
 * thousands of stack traces per minute in the dev log, and an unhandled
 * 'error' on an EventEmitter can terminate the Node process outright.
 *
 * Three changes:
 *   - an `error` listener that logs ONCE, so the event is always handled
 *   - a retry strategy that gives up after a few attempts and disables the
 *     client, rather than reconnecting forever
 *   - `enableOfflineQueue: false`, so commands fail immediately instead of
 *     buffering in memory waiting for a server that isn't coming back
 */
let client: Redis | null = null;
let disabled = false;
let warned = false;

const MAX_CONNECT_ATTEMPTS = 3;

function disable(reason: string): void {
  if (!disabled) {
    disabled = true;
    console.warn(`[redis] Disabled for this process — ${reason}. Leaderboard falls back to Postgres.`);
  }
  if (client) {
    // `disconnect()` rather than `quit()`: quit tries to talk to a server we
    // have just established we cannot reach.
    client.disconnect();
    client = null;
  }
}

export function getRedisClient(): Redis | null {
  if (disabled) return null;
  if (client) return client;

  const url = process.env.REDIS_URL;
  if (!url) return null;

  client = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    retryStrategy(times) {
      if (times > MAX_CONNECT_ATTEMPTS) {
        disable(`could not connect after ${MAX_CONNECT_ATTEMPTS} attempts`);
        return null; // stop retrying
      }
      return Math.min(times * 200, 1000);
    },
  });

  // Must exist even if it did nothing: an unhandled 'error' event on an
  // EventEmitter throws. Logging once keeps the signal without the flood.
  client.on('error', (err: Error) => {
    if (!warned) {
      warned = true;
      console.warn(`[redis] Connection error: ${err.message} (further errors suppressed)`);
    }
  });

  return client;
}

/**
 * Run a Redis operation, returning `fallback` if Redis is absent or misbehaving.
 * Every export below goes through this, so no caller has to care whether Redis
 * is up.
 */
async function safe<T>(fn: (redis: Redis) => Promise<T>, fallback: T): Promise<T> {
  const redis = getRedisClient();
  if (!redis) return fallback;
  try {
    return await fn(redis);
  } catch (err) {
    if (!warned) {
      warned = true;
      console.warn(`[redis] Operation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    return fallback;
  }
}

export const leaderboard = {
  /**
   * Update an agent's score in both the category-specific and global leaderboards.
   */
  async updateScore(category: string, agentSlug: string, score: number): Promise<void> {
    await safe(async (redis) => {
      const pipeline = redis.pipeline();
      pipeline.zadd(`leaderboard:${category}`, score, agentSlug);
      pipeline.zadd('leaderboard:all', score, agentSlug);
      await pipeline.exec();
    }, undefined);
  },

  /**
   * Get the top N agents for a category (or "all") sorted by score descending.
   */
  async getTop(category: string, limit: number = 10): Promise<{ slug: string; score: number }[]> {
    return safe(async (redis) => {
      const results = await redis.zrevrange(`leaderboard:${category}`, 0, limit - 1, 'WITHSCORES');
      const entries: { slug: string; score: number }[] = [];
      for (let i = 0; i < results.length; i += 2) {
        entries.push({ slug: results[i], score: parseFloat(results[i + 1]) });
      }
      return entries;
    }, []);
  },

  /**
   * Get an agent's rank (0-based) within a category. Returns null if not ranked.
   */
  async getRank(category: string, agentSlug: string): Promise<number | null> {
    return safe(async (redis) => redis.zrevrank(`leaderboard:${category}`, agentSlug), null);
  },

  /**
   * Remove an agent from both the category-specific and global leaderboards.
   */
  async remove(category: string, agentSlug: string): Promise<void> {
    await safe(async (redis) => {
      const pipeline = redis.pipeline();
      pipeline.zrem(`leaderboard:${category}`, agentSlug);
      pipeline.zrem('leaderboard:all', agentSlug);
      await pipeline.exec();
    }, undefined);
  },
};
