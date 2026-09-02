import Redis from 'ioredis';

let client: Redis | null = null;

export function getRedisClient(): Redis | null {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = new Redis(url, { maxRetriesPerRequest: 3 });
  return client;
}

export const leaderboard = {
  /**
   * Update an agent's score in both the category-specific and global leaderboards.
   */
  async updateScore(
    category: string,
    agentSlug: string,
    score: number,
  ): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    const categoryKey = `leaderboard:${category}`;
    const allKey = 'leaderboard:all';

    const pipeline = redis.pipeline();
    pipeline.zadd(categoryKey, score, agentSlug);
    pipeline.zadd(allKey, score, agentSlug);
    await pipeline.exec();
  },

  /**
   * Get the top N agents for a category (or "all") sorted by score descending.
   */
  async getTop(
    category: string,
    limit: number = 10,
  ): Promise<{ slug: string; score: number }[]> {
    const redis = getRedisClient();
    if (!redis) return [];

    const key = `leaderboard:${category}`;
    const results = await redis.zrevrange(key, 0, limit - 1, 'WITHSCORES');

    const entries: { slug: string; score: number }[] = [];
    for (let i = 0; i < results.length; i += 2) {
      entries.push({ slug: results[i], score: parseFloat(results[i + 1]) });
    }
    return entries;
  },

  /**
   * Get an agent's rank (0-based) within a category. Returns null if not ranked.
   */
  async getRank(
    category: string,
    agentSlug: string,
  ): Promise<number | null> {
    const redis = getRedisClient();
    if (!redis) return null;

    const key = `leaderboard:${category}`;
    const rank = await redis.zrevrank(key, agentSlug);
    return rank;
  },

  /**
   * Remove an agent from both the category-specific and global leaderboards.
   */
  async remove(category: string, agentSlug: string): Promise<void> {
    const redis = getRedisClient();
    if (!redis) return;

    const categoryKey = `leaderboard:${category}`;
    const allKey = 'leaderboard:all';

    const pipeline = redis.pipeline();
    pipeline.zrem(categoryKey, agentSlug);
    pipeline.zrem(allKey, agentSlug);
    await pipeline.exec();
  },
};
