import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { nanoid } from "nanoid";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function generateApiKey(): string {
  return `ak_live_${nanoid(32)}`;
}

/**
 * Where seeded agents point.
 *
 * These used to point at `https://demo.acoustickitty.ai/mock/<slug>`, which
 * does not exist. The orchestrator's health monitor probed them, failed, and
 * after three failures demoted every agent to `degraded` — at which point the
 * landing page (which filters on `status: "active"`) showed "No agents deployed
 * yet" and the whole marketplace looked empty.
 *
 * Pointing them at this app's own mock endpoint makes them genuinely healthy
 * rather than forcing the status back, which the monitor would only undo again.
 *
 * Note the monitor probes `new URL('/health', endpointUrl)` — resolved against
 * the ORIGIN, not the path — so what matters is that this origin serves
 * `/health`. See src/app/health/route.ts.
 */
const AGENT_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

async function main() {
  // Create demo provider
  const provider = await prisma.user.upsert({
    where: { email: "demo-provider@acoustickitty.ai" },
    update: {},
    create: {
      email: "demo-provider@acoustickitty.ai",
      name: "AgentVault Demo",
      role: "provider",
      apiKey: generateApiKey(),
    },
  });

  // Create demo subscriber
  const subscriber = await prisma.user.upsert({
    where: { email: "demo-subscriber@acoustickitty.ai" },
    update: {},
    create: {
      email: "demo-subscriber@acoustickitty.ai",
      name: "Demo User",
      role: "subscriber",
      apiKey: generateApiKey(),
      plan: "builder",
      callsLimit: 25000,
    },
  });

  // The marketplace's own provider identity. Native agents hang off this row,
  // and PLATFORM_USER_ID (used by the monthly payout run for its
  // retained_native reporting line) should point at the same one.
  const platform = await prisma.user.upsert({
    where: { email: process.env.PLATFORM_PROVIDER_EMAIL || "station@acoustickitty.ai" },
    update: { role: "provider" },
    create: {
      email: process.env.PLATFORM_PROVIDER_EMAIL || "station@acoustickitty.ai",
      name: "Acoustic Kitty",
      role: "provider",
      onboardingComplete: true,
      chargesEnabled: true,
      payoutsEnabled: true,
    },
  });

  // A deliberately throwaway native agent, for walking the flow end to end:
  // it should show up under STATION ISSUE on the landing page, carry the
  // native flag through /api/agents?native=true, and have its usage retained
  // by the platform rather than entering the provider payout pool.
  await prisma.agent.upsert({
    where: { slug: "gimmick" },
    update: {
      native: true,
      providerId: platform.id,
      status: "active",
      endpointUrl: `${AGENT_BASE_URL}/api/mock/agent`,
    },
    create: {
      slug: "gimmick",
      name: "Gimmick",
      description:
        "Station-issue test operative. Echoes what you send it with a bit of theatre. Exists so the in-house agent path can be walked end to end without touching a real provider's listing.",
      shortDesc: "Station-issue test operative. Echoes what you send it, with theatre.",
      category: "other",
      tags: ["Test", "In-house", "Echo"],
      providerId: platform.id,
      native: true,
      endpointUrl: `${AGENT_BASE_URL}/api/mock/agent`,
      connectorType: "api",
      authType: "none",
      pricingModel: "platform",
      pricePerCall: 20,
      modelTier: "haiku",
      status: "active",
      currentScore: 88.0,
      latencyP50: 95,
      latencyP95: 170,
      uptime: 99.99,
      totalCalls: 0,
      rating: 4.5,
      reviewCount: 0,
      currentRank: 9,
      trendDelta: 0,
    },
  });

  // Seed agents
  const agents = [
    {
      name: "DocuMind",
      slug: "documind",
      category: "document-analysis",
      score: 97.3,
      latency: 120,
      desc: "Production-grade document parsing, extraction and summarisation across 40+ file types.",
      tags: ["RAG", "OCR", "Multi-modal"],
      connector: "api",
      pricing: "usage",
    },
    {
      name: "SalesForge",
      slug: "salesforge",
      category: "sales-automation",
      score: 95.8,
      latency: 340,
      desc: "End-to-end sales pipeline agent — prospecting, outreach sequencing, and deal scoring.",
      tags: ["CRM", "Email", "Scoring"],
      connector: "api",
      pricing: "subscription",
    },
    {
      name: "CodeAudit",
      slug: "codeaudit",
      category: "code-review",
      score: 94.1,
      latency: 890,
      desc: "Automated code review with security vulnerability detection across 12 languages.",
      tags: ["Security", "SAST", "CI/CD"],
      connector: "api",
      pricing: "usage",
    },
    {
      name: "DataWeaver",
      slug: "dataweaver",
      category: "data-pipeline",
      score: 93.6,
      latency: 450,
      desc: "Autonomous data pipeline construction — schema inference, transformation, and validation.",
      tags: ["ETL", "SQL", "Streaming"],
      connector: "api",
      pricing: "hybrid",
    },
    {
      name: "LegalLens",
      slug: "legallens",
      category: "legal",
      score: 92.4,
      latency: 1200,
      desc: "Contract analysis, clause extraction, risk flagging and compliance checking.",
      tags: ["NLP", "Compliance", "Risk"],
      connector: "api",
      pricing: "subscription",
    },
    {
      name: "PixelForge",
      slug: "pixelforge",
      category: "creative",
      score: 91.7,
      latency: 2100,
      desc: "Multi-model image generation and editing agent with brand-consistent style enforcement.",
      tags: ["Image Gen", "Brand", "Batch"],
      connector: "api",
      pricing: "usage",
    },
    {
      name: "SupportBot",
      slug: "supportbot",
      category: "customer-support",
      score: 90.2,
      latency: 180,
      desc: "Intelligent ticket routing, auto-resolution and escalation with human handoff.",
      tags: ["Tickets", "NLU", "HITL"],
      connector: "api",
      pricing: "hybrid",
    },
    {
      name: "ResearchPilot",
      slug: "researchpilot",
      category: "research",
      score: 89.5,
      latency: 3400,
      desc: "Deep research agent — multi-source synthesis, citation extraction, and report generation.",
      tags: ["Search", "Synthesis", "Academic"],
      connector: "api",
      pricing: "usage",
    },
  ];

  for (const a of agents) {
    const idx = agents.indexOf(a);
    await prisma.agent.upsert({
      where: { slug: a.slug },
      update: {
        currentScore: a.score,
        // Re-seeding also repairs agents the health monitor demoted.
        status: "active",
        endpointUrl: `${AGENT_BASE_URL}/api/mock/agent`,
      },
      create: {
        slug: a.slug,
        name: a.name,
        description: a.desc,
        shortDesc: a.desc.slice(0, 200),
        category: a.category,
        tags: a.tags,
        providerId: provider.id,
        endpointUrl: `${AGENT_BASE_URL}/api/mock/agent`,
        connectorType: a.connector,
        authType: "none",
        pricingModel: a.pricing,
        pricePerCall: 20,
        status: "active",
        currentScore: a.score,
        latencyP50: a.latency,
        latencyP95: Math.round(a.latency * 1.8),
        uptime: 99.9 + Math.random() * 0.09,
        totalCalls: Math.floor(Math.random() * 5000000),
        rating: Math.round((4.4 + Math.random() * 0.6) * 10) / 10,
        reviewCount: Math.floor(Math.random() * 2000),
        currentRank: idx + 1,
        trendDelta: Math.round((Math.random() * 8 - 2) * 10) / 10,
      },
    });
  }

  console.log("Seeded successfully!");
  console.log("Provider API key:", provider.apiKey);
  console.log("Subscriber API key:", subscriber.apiKey);
  console.log("");
  console.log("Platform (native agent owner) user id:", platform.id);
  console.log("  -> put this in .env as PLATFORM_USER_ID=" + platform.id);
  console.log("Native agent seeded: gimmick");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
