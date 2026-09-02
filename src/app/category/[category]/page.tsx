import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { baseMetadata } from "@/lib/seo";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CategoryGrid } from "./CategoryGrid";

export const dynamic = "force-dynamic";

const ALL_CATEGORIES = [
  "document-analysis",
  "sales-automation",
  "code-review",
  "data-pipeline",
  "legal",
  "creative",
  "customer-support",
  "research",
  "dev-tools",
  "marketing",
  "finance",
];

function formatCategory(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function generateStaticParams() {
  return ALL_CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  const label = formatCategory(category);
  return baseMetadata({
    title: `Division: ${label} — Agent Operatives`,
    description: `Top-ranked AI agents in the ${label} division. Performance-benchmarked scores, latency, and reliability.`,
  });
}

const paperBg = {
  background: "var(--ak-paper)",
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(0,0,0,0.015) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(0,0,0,0.018) 0%, transparent 40%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")
  `,
};

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;
  const label = formatCategory(category);

  const [agents, totalCount] = await Promise.all([
    prisma.agent.findMany({
      where: { status: "active", category },
      orderBy: { currentScore: "desc" },
      include: { provider: { select: { name: true } } },
    }),
    prisma.agent.count({ where: { status: "active", category } }),
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

  return (
    <>
      {/* ═══════════ HERO ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 pt-20 pb-14"
      >
        <div className="mb-8">
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: "Divisions", href: "/" },
              { name: label, href: `/category/${category}` },
            ]}
          />
        </div>

        <div
          className="flex justify-between mb-10"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--ak-ink3)",
          }}
        >
          <span>FILE NO. AK—DIV/{category.toUpperCase()}</span>
          <span>◆ DIVISION DOSSIER</span>
        </div>

        <div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(56px, 10vw, 160px)",
              lineHeight: 0.88,
              letterSpacing: -4,
              color: "var(--ak-ink)",
            }}
          >
            {label}
          </h1>

          <p
            className="mt-6 border-t pt-5"
            style={{
              borderColor: "var(--ak-rule)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: 1.8,
              color: "var(--ak-ink2)",
              textTransform: "uppercase",
            }}
          >
            {totalCount} OPERATIVE{totalCount !== 1 ? "S" : ""} ASSIGNED TO THIS DIVISION
          </p>
        </div>
      </section>

      {/* ═══════════ /01 OPERATIVES ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 py-14"
      >
        <div
          className="mb-8 flex items-baseline justify-between"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--ak-ink3)",
          }}
        >
          <span>/01 · OPERATIVES</span>
          <span>RANKED BY FIELD SCORE</span>
        </div>

        <CategoryGrid agents={serialized} />
      </section>
    </>
  );
}
