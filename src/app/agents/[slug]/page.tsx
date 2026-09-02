import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  baseMetadata,
  agentJsonLd,
  breadcrumbJsonLd,
} from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Badge } from "@/components/Badge";
import { Star } from "lucide-react";
import { AgentPlayground } from "@/components/AgentPlayground";
import { MODEL_TIER_WEIGHTS } from "@/lib/plans";

export const revalidate = 3600;

function formatCategory(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function generateStaticParams() {
  try {
    const agents = await prisma.agent.findMany({
      where: { status: "active" },
      select: { slug: true },
    });
    return agents.map((a) => ({ slug: a.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const agent = await prisma.agent.findUnique({
    where: { slug },
    select: { name: true, shortDesc: true, category: true },
  });
  if (!agent) return {};
  return baseMetadata({
    title: `${agent.name} — Agent Dossier`,
    description:
      agent.shortDesc ||
      `Performance dossier for ${agent.name}. Benchmarked scores, latency, and deployment details.`,
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

const classifiedBg = {
  background: "var(--ak-classified)",
  backgroundImage: `
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.03 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")
  `,
};

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const agent = await prisma.agent.findUnique({
    where: { slug },
    include: {
      provider: { select: { name: true } },
      benchmarks: {
        orderBy: { createdAt: "desc" },
        take: 10,
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!agent) notFound();

  const score = agent.currentScore ?? 0;

  return (
    <>
      <JsonLd
        data={agentJsonLd({
          name: agent.name,
          description: agent.shortDesc || agent.description,
          slug: agent.slug,
          category: agent.category,
          rating: agent.rating,
          reviewCount: agent.reviewCount,
          pricingModel: agent.pricingModel,
          pricePerCall: agent.pricePerCall,
        })}
      />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", url: "/" },
          { name: "Agents", url: "/" },
          { name: agent.name, url: `/agents/${agent.slug}` },
        ])}
      />

      {/* ═══════════ HERO / DOSSIER HEAD ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 pt-20 pb-14"
      >
        <div className="mb-8">
          <Breadcrumbs
            items={[
              { name: "Home", href: "/" },
              { name: "Agents", href: "/" },
              { name: agent.name, href: `/agents/${agent.slug}` },
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
          <span>DOSSIER / OP-{agent.id.slice(-4).toUpperCase()}</span>
          <span>◆ CLASSIFIED DOSSIER</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-14 items-end">
          <div>
            <div
              className="mb-3"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 2,
                color: "var(--ak-ink3)",
              }}
            >
              {formatCategory(agent.category).toUpperCase()} &nbsp;·&nbsp; {(agent.provider.name ?? "Unknown").toUpperCase()}
            </div>
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(56px, 9vw, 144px)",
                lineHeight: 0.88,
                letterSpacing: -4,
                color: "var(--ak-ink)",
              }}
            >
              {agent.name}
            </h1>

            <div className="mt-5 flex items-center gap-2 flex-wrap">
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1.5,
                  color: "var(--ak-ink3)",
                }}
              >
                {agent.connectorType.toUpperCase()}
              </span>
              {agent.status === "active" && score > 0 && (
                <Badge variant="elite">VERIFIED</Badge>
              )}
              {(agent.trendDelta ?? 0) > 3 && <Badge variant="hot">TRENDING</Badge>}
              {(MODEL_TIER_WEIGHTS[agent.modelTier] ?? 1) > 1 && (
                <Badge variant="active">
                  {MODEL_TIER_WEIGHTS[agent.modelTier] ?? 1} CALLS/REQ
                </Badge>
              )}
            </div>
          </div>

          {/* Score card */}
          <div
            className="border p-6"
            style={{ ...paperBg, borderColor: "var(--ak-ink)" }}
          >
            <div
              className="mb-3"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 2,
                color: "var(--ak-ink3)",
              }}
            >
              BENCHMARK SCORE
            </div>
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 108,
                lineHeight: 0.9,
                letterSpacing: -3,
                color: "var(--ak-ink)",
              }}
            >
              {score > 0 ? score.toFixed(1) : "N/A"}
              {score > 0 && (
                <span
                  style={{
                    fontSize: 32,
                    color: "var(--ak-ink3)",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  /10
                </span>
              )}
            </div>
            {score > 0 && (
              <div
                className="mt-4 h-1.5 relative"
                style={{ background: "var(--ak-paper-deep)" }}
              >
                <div
                  className="absolute top-0 left-0 bottom-0"
                  style={{ width: `${Math.min(100, score * 10)}%`, background: "var(--ak-signal)" }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ═══════════ /01 TELEMETRY ═══════════ */}
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
          <span>/01 · TELEMETRY</span>
          <span>LAST 30 DAYS</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 border-l border-t" style={{ borderColor: "var(--ak-rule)" }}>
          {[
            {
              label: "SCORE",
              value: score > 0 ? score.toFixed(1) : "N/A",
            },
            {
              label: "LATENCY",
              value: agent.latencyP50 ? `${agent.latencyP50}ms` : "N/A",
            },
            {
              label: "OPERATIONS",
              value:
                agent.totalCalls >= 1000
                  ? `${(agent.totalCalls / 1000).toFixed(1)}K`
                  : String(agent.totalCalls),
            },
            {
              label: "PRICE PER CALL",
              value: `$${(agent.pricePerCall / 100).toFixed(2)}`,
            },
            {
              label: "CALL WEIGHT",
              value: `${MODEL_TIER_WEIGHTS[agent.modelTier] ?? 1}x`,
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="p-6 border-r border-b"
              style={{ borderColor: "var(--ak-rule)" }}
            >
              <span
                className="block mb-3"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: "var(--ak-ink3)",
                }}
              >
                {stat.label}
              </span>
              <span
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 38,
                  lineHeight: 1,
                  letterSpacing: -1,
                  color: "var(--ak-ink)",
                }}
              >
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ /02 MISSION BRIEF ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 py-16"
      >
        <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-14">
          <div>
            <div
              className="mb-2.5"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 2,
                color: "var(--ak-ink3)",
              }}
            >
              /02 · MISSION BRIEF
            </div>
            {agent.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-6">
                {agent.tags.map((tag) => (
                  <Badge key={tag} variant="field">
                    {tag}
                  </Badge>
                ))}
                <Badge variant="active">
                  {agent.pricingModel.toUpperCase()}
                </Badge>
              </div>
            )}
          </div>
          <div>
            <p
              className="max-w-3xl"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 18,
                lineHeight: 1.55,
                color: "var(--ak-ink2)",
              }}
            >
              {agent.description}
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════ /03 DEPLOY COMMAND ═══════════ */}
      <section
        style={{ ...classifiedBg, borderBottom: "1px solid #2a2824" }}
        className="px-8 sm:px-14 py-16"
      >
        <div
          className="mb-8 flex items-baseline justify-between"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 2,
            color: "#8a8478",
          }}
        >
          <span>/03 · DEPLOY COMMAND</span>
          <span style={{ color: "var(--ak-signal)" }}>◆ CURL</span>
        </div>

        <div
          className="border overflow-hidden"
          style={{ borderColor: "#2a2824", background: "#0a0908" }}
        >
          <pre
            className="p-6 overflow-x-auto text-sm leading-relaxed"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            <code style={{ color: "var(--ak-signal)" }}>{`curl -X POST https://acoustickitty.ai/api/v1/run \\
  -H "Authorization: Bearer $AK_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "agent": "${agent.slug}",
    "input": "Your task here",
    "strategy": "performance"
  }'`}</code>
          </pre>
        </div>

        <div className="mt-8 flex items-center gap-3 flex-wrap">
          <a
            href="#playground"
            className="px-5 py-3.5 text-sm font-medium"
            style={{
              fontFamily: "var(--font-sans)",
              background: "var(--ak-signal)",
              color: "var(--ak-ink)",
              border: "1px solid var(--ak-signal)",
            }}
          >
            TRY THIS AGENT ↗
          </a>
          {agent.docsUrl && (
            <a
              href={agent.docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-3.5 text-sm font-medium"
              style={{
                fontFamily: "var(--font-sans)",
                background: "transparent",
                color: "#f1ece2",
                border: "1px solid #3a3632",
              }}
            >
              VIEW DOCS
            </a>
          )}
        </div>
      </section>

      {/* ═══════════ /04 BENCHMARK HISTORY ═══════════ */}
      {agent.benchmarks.length > 0 && (
        <section
          style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
          className="px-8 sm:px-14 py-16"
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
            <span>/04 · BENCHMARK HISTORY</span>
            <span>{agent.benchmarks.length} RUNS</span>
          </div>

          <div
            className="overflow-x-auto border"
            style={{ borderColor: "var(--ak-rule)" }}
          >
            <table className="w-full" style={{ minWidth: 640 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ak-rule)" }}>
                  {[
                    "DATE",
                    "SCORE",
                    "ACCURACY",
                    "P50 LATENCY",
                    "ERROR RATE",
                    "EDGE CASES",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: 1.5,
                        color: "var(--ak-ink3)",
                        fontWeight: 400,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {agent.benchmarks.map((b) => (
                  <tr
                    key={b.id}
                    style={{ borderBottom: "1px solid var(--ak-rule-soft)" }}
                  >
                    <td
                      className="px-4 py-3"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: "var(--ak-ink3)",
                      }}
                    >
                      {new Date(b.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: 18,
                        letterSpacing: -0.3,
                        color: "var(--ak-ink)",
                      }}
                    >
                      {b.score.toFixed(1)}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--ak-ink2)",
                      }}
                    >
                      {(b.accuracy * 100).toFixed(1)}%
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--ak-ink2)",
                      }}
                    >
                      {b.latencyP50}ms
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--ak-ink2)",
                      }}
                    >
                      {(b.errorRate * 100).toFixed(1)}%
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--ak-ink2)",
                      }}
                    >
                      {(b.edgeCaseScore * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ═══════════ /05 FIELD REPORTS ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 py-16"
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
          <span>/05 · FIELD REPORTS ({agent.reviewCount})</span>
        </div>

        {agent.reviews.length > 0 ? (
          <div className="border-t" style={{ borderColor: "var(--ak-rule)" }}>
            {agent.reviews.map((r) => (
              <div
                key={r.id}
                className="py-5 border-b"
                style={{ borderColor: "var(--ak-rule)" }}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        size={12}
                        style={{
                          color: i < r.rating ? "var(--ak-signal-deep)" : "var(--ak-rule)",
                          fill: i < r.rating ? "var(--ak-signal-deep)" : "transparent",
                        }}
                      />
                    ))}
                  </div>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: 1.5,
                      color: "var(--ak-ink3)",
                    }}
                  >
                    {new Date(r.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {r.comment && (
                  <p
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 15,
                      lineHeight: 1.55,
                      color: "var(--ak-ink2)",
                    }}
                  >
                    {r.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div
            className="text-center py-16 border-t border-b"
            style={{ borderColor: "var(--ak-rule)" }}
          >
            <p
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 2.5,
                color: "var(--ak-ink3)",
              }}
            >
              NO FIELD REPORTS FILED
            </p>
          </div>
        )}
      </section>

      {/* ═══════════ /06 PLAYGROUND ═══════════ */}
      <section
        id="playground"
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 py-16"
      >
        <AgentPlayground agentSlug={agent.slug} agentName={agent.name} />
      </section>
    </>
  );
}
