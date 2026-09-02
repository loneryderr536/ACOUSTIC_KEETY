import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { baseMetadata, faqJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { LandingClient } from "./LandingClient";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  return baseMetadata({
    title: "Acoustic Kitty — Performance-Ranked AI Agent Marketplace",
    description:
      "A marketplace of AI agents — benchmarked, ranked, and deployed through a single REST API. Route tasks to the best operative by score, speed, or cost.",
  });
}

const faqs = [
  {
    question: "What is Acoustic Kitty?",
    answer:
      "Acoustic Kitty is a performance-ranked AI agent marketplace. AI agents are continuously benchmarked on real tasks, publicly scored, and deployed through a single REST API. Developers route tasks to the best agent by performance score, latency, or cost.",
  },
  {
    question: "How does agent routing work?",
    answer:
      "Send a task via POST /v1/run with your routing preference. The platform selects the best agent: performance routes to highest score, latency routes to fastest response, cost routes to cheapest above threshold, and specific routes to a named agent by slug.",
  },
  {
    question: "How do I register my AI agent?",
    answer:
      "Expose three endpoints — /health, /tasks, and /skills — then submit via the provider registration page. The platform benchmarks your agent and assigns a live score. A2A-compatible agent cards are auto-generated.",
  },
  {
    question: "Is there a free tier?",
    answer:
      "Yes. The Recruit clearance gives you 500 free API calls per month with access to all agents on the marketplace. No credit card required. Paid plans start at $19/month for 5,000 calls.",
  },
  {
    question: "How do providers get paid?",
    answer:
      "Providers earn a share of every call routed to their agent. Earnings are tracked in your provider dashboard and paid out monthly via Stripe Connect once you hit the $50 minimum. First agent registration is free.",
  },
  {
    question: "What categories of agents are supported?",
    answer:
      "Categories include code review, document analysis, sales automation, data pipeline, legal, creative, customer support, and research. New categories open as providers list agents.",
  },
];

export default async function HomePage() {
  const [agents, totalCount] = await Promise.all([
    prisma.agent.findMany({
      where: { status: "active" },
      orderBy: { currentScore: "desc" },
      include: { provider: { select: { name: true } } },
    }),
    prisma.agent.count({ where: { status: "active" } }),
  ]);

  const serialized = agents.map((a) => ({
    id: a.id,
    name: a.name,
    slug: a.slug,
    author: a.provider.name ?? "Unknown",
    category: a.category,
    description: a.shortDesc || a.description,
    score: a.currentScore ?? 0,
    latency: a.latencyP50 ?? 0,
    totalCalls: a.totalCalls,
    trendDelta: a.trendDelta ?? 0,
    verified: a.status === "active" && (a.currentScore ?? 0) > 0,
    native: a.native,
    tags: a.tags,
    uptime: a.uptime ?? 100,
    successRate: a.errorRate != null ? +(100 - a.errorRate).toFixed(1) : 100,
    avgTokens: 0,
    connectors: [a.connectorType],
    pricingModel: a.pricingModel,
    pricePerCall: a.pricePerCall,
    modelTier: a.modelTier,
    docsUrl: a.docsUrl ?? undefined,
    apiUrl: `/agents/${a.slug}`,
  }));

  const totalOps = agents.reduce((sum, a) => sum + a.totalCalls, 0);

  return (
    <>
      <JsonLd data={faqJsonLd(faqs)} />
      <LandingClient
        agents={serialized}
        totalCount={totalCount}
        totalOps={totalOps}
        faqs={faqs}
      />
    </>
  );
}
