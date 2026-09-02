import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { nanoid } from "nanoid";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function generateApiKey(): string {
  return `ak_live_${nanoid(32)}`;
}

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
      update: { currentScore: a.score },
      create: {
        slug: a.slug,
        name: a.name,
        description: a.desc,
        shortDesc: a.desc.slice(0, 200),
        category: a.category,
        tags: a.tags,
        providerId: provider.id,
        endpointUrl: `https://demo.acoustickitty.ai/mock/${a.slug}`,
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
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
