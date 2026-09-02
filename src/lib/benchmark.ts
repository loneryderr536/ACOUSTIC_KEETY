import { prisma } from './prisma';
import { proxyToAgent } from './router';
import { leaderboard } from './redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TestCase {
  name: string;
  input: Record<string, unknown>;
  expected: unknown;
  isEdgeCase?: boolean;
}

interface TestResult {
  name: string;
  passed: boolean;
  accuracy: number;
  latencyMs: number;
  isEdgeCase: boolean;
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

/**
 * Return a basic test suite for a given category.
 * Every suite includes a health_check and an echo test.
 */
export function getTestSuite(category: string): TestCase[] {
  const baseSuite: TestCase[] = [
    {
      name: 'health_check',
      input: { task: 'health_check' },
      expected: { status: 'ok' },
    },
    {
      name: 'echo',
      input: { task: 'echo', message: 'hello' },
      expected: { message: 'hello' },
    },
  ];

  // Categories can extend the base suite in the future
  switch (category) {
    default:
      return baseSuite;
  }
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Score accuracy of an actual result against expected.
 * - Exact match (primitives or JSON-equal) = 100
 * - Object fuzzy: percentage of expected keys that match
 * - Otherwise 0
 */
export function scoreAccuracy(actual: unknown, expected: unknown): number {
  // Exact primitive match or JSON-equal
  if (actual === expected) return 100;

  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson === expectedJson) return 100;

  // Fuzzy key overlap for objects
  if (
    typeof actual === 'object' &&
    actual !== null &&
    typeof expected === 'object' &&
    expected !== null &&
    !Array.isArray(expected)
  ) {
    const expectedKeys = Object.keys(expected as Record<string, unknown>);
    if (expectedKeys.length === 0) return 100;

    const actualObj = actual as Record<string, unknown>;
    const expectedObj = expected as Record<string, unknown>;

    let matchingKeys = 0;
    for (const key of expectedKeys) {
      if (
        key in actualObj &&
        JSON.stringify(actualObj[key]) === JSON.stringify(expectedObj[key])
      ) {
        matchingKeys++;
      }
    }

    return Math.round((matchingKeys / expectedKeys.length) * 100);
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Main benchmark runner
// ---------------------------------------------------------------------------

/**
 * Run the full benchmark suite for an agent.
 *
 * 1. Fetches the agent and sets status to "benchmarking"
 * 2. Runs each test case, collecting accuracy and latency
 * 3. Computes composite score:
 *      60% accuracy + 20% latency + 10% reliability + 10% edge case
 * 4. Persists Benchmark record & updates Agent scores
 * 5. Updates Redis leaderboard if composite >= 50
 */
export async function runBenchmark(agentId: string) {
  // 1. Fetch agent & flip to benchmarking
  const agent = await prisma.agent.findUniqueOrThrow({
    where: { id: agentId },
  });

  await prisma.agent.update({
    where: { id: agentId },
    data: { status: 'benchmarking' },
  });

  try {
    const testSuite = getTestSuite(agent.category);
    const results: TestResult[] = [];

    // 2. Execute each test
    for (const test of testSuite) {
      try {
        const { data, latencyMs, status } = await proxyToAgent(
          agent.endpointUrl,
          agent.authType,
          agent.authToken,
          test.input,
        );

        const accuracy =
          status === 'success' ? scoreAccuracy(data, test.expected) : 0;

        results.push({
          name: test.name,
          passed: accuracy >= 80,
          accuracy,
          latencyMs,
          isEdgeCase: test.isEdgeCase ?? false,
        });
      } catch {
        results.push({
          name: test.name,
          passed: false,
          accuracy: 0,
          latencyMs: 0,
          isEdgeCase: test.isEdgeCase ?? false,
        });
      }
    }

    // 3. Compute scores
    const totalTests = results.length;
    const standardTests = results.filter((r) => !r.isEdgeCase);
    const edgeTests = results.filter((r) => r.isEdgeCase);

    // Accuracy: average across all tests
    const accuracyScore =
      totalTests > 0
        ? results.reduce((sum, r) => sum + r.accuracy, 0) / totalTests
        : 0;

    // Latency score: 100 if p50 < 200ms, 0 if > 5000ms, linear in between
    const latencies = results.map((r) => r.latencyMs).filter((l) => l > 0).sort((a, b) => a - b);
    const latencyP50 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.5)] : 0;
    const latencyP95 = latencies.length > 0 ? latencies[Math.floor(latencies.length * 0.95)] : 0;
    const latencyScore = latencies.length > 0
      ? Math.max(0, Math.min(100, 100 - ((latencyP50 - 200) / 4800) * 100))
      : 0;

    // Reliability: percentage of tests that passed
    const reliabilityScore =
      totalTests > 0
        ? (results.filter((r) => r.passed).length / totalTests) * 100
        : 0;

    // Edge case score
    const edgeCaseScore =
      edgeTests.length > 0
        ? (edgeTests.filter((r) => r.passed).length / edgeTests.length) * 100
        : 100; // Default to 100 if no edge cases in suite

    // Error rate
    const errorRate =
      totalTests > 0
        ? (results.filter((r) => !r.passed).length / totalTests) * 100
        : 100;

    // Composite: 60% accuracy + 20% latency + 10% reliability + 10% edge case
    const rawComposite =
      accuracyScore * 0.6 +
      latencyScore * 0.2 +
      reliabilityScore * 0.1 +
      edgeCaseScore * 0.1;
    const compositeScore = Number.isFinite(rawComposite)
      ? Math.min(100, Math.max(0, rawComposite))
      : 0;

    // 4. Persist benchmark record
    await prisma.benchmark.create({
      data: {
        agentId,
        score: compositeScore,
        accuracy: Math.min(100, Math.max(0, accuracyScore)),
        latencyP50,
        latencyP95,
        errorRate: Math.min(100, Math.max(0, errorRate)),
        edgeCaseScore: Math.min(100, Math.max(0, edgeCaseScore)),
        rawResults: results.map(r => ({
          name: r.name,
          passed: r.passed,
          accuracy: Number.isFinite(r.accuracy) ? r.accuracy : 0,
          latencyMs: Number.isFinite(r.latencyMs) ? r.latencyMs : 0,
          isEdgeCase: r.isEdgeCase,
        })),
      },
    });

    // Update agent denormalised scores
    await prisma.agent.update({
      where: { id: agentId },
      data: {
        currentScore: compositeScore,
        latencyP50,
        latencyP95,
        errorRate,
        status: 'active',
      },
    });

    // 5. Update leaderboard if score is sufficient
    if (compositeScore >= 50) {
      await leaderboard.updateScore(agent.category, agent.slug, compositeScore);
    }

    return {
      compositeScore,
      accuracyScore,
      latencyScore,
      reliabilityScore,
      edgeCaseScore,
      latencyP50,
      latencyP95,
      errorRate,
      results,
    };
  } catch (err) {
    // Reset agent status so it doesn't stay stuck in 'benchmarking'
    await prisma.agent.update({
      where: { id: agentId },
      data: { status: 'pending' },
    });
    throw err;
  }
}
