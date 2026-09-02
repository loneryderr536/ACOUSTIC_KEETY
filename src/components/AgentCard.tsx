"use client";

import { Badge } from "./Badge";
import { MODEL_TIER_WEIGHTS } from "@/lib/plans";

interface Agent {
  id: string;
  name: string;
  slug: string;
  author: string;
  category: string;
  description: string;
  score: number;
  latency: number;
  totalCalls: number;
  trendDelta: number;
  verified: boolean;
  tags: string[];
  uptime: number;
  successRate: number;
  avgTokens: number;
  connectors: string[];
  pricingModel: string;
  pricePerCall: number;
  modelTier?: string;
  docsUrl?: string;
  apiUrl?: string;
}

function formatCalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function formatCategory(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function AgentCard({
  agent,
  index,
  layout = "normal",
  onSelect,
}: {
  agent: Agent;
  index: number;
  layout?: "hero" | "wide" | "normal";
  onSelect: (agent: Agent) => void;
}) {
  const isElite = agent.score >= 9.3;
  const isHot = agent.trendDelta > 3;
  const callWeight = MODEL_TIER_WEIGHTS[agent.modelTier ?? "unknown"] ?? 1;

  const layoutClasses =
    layout === "hero"
      ? "col-span-2 row-span-2"
      : layout === "wide"
        ? "col-span-2"
        : "";

  const nameSize =
    layout === "hero"
      ? "clamp(48px, 6vw, 96px)"
      : layout === "wide"
        ? "clamp(36px, 4.5vw, 64px)"
        : "28px";

  const showDescription = layout === "hero" || layout === "wide";

  return (
    <button
      onClick={() => onSelect(agent)}
      className={`group relative text-left cursor-pointer border-r border-b hover:bg-[var(--ak-paper-light)] transition-colors ${layoutClasses}`}
      style={{
        borderColor: "var(--ak-rule)",
        background: "transparent",
        animation: `cardIn 0.6s ease-out ${index * 0.06}s both`,
      }}
    >
      <div className="relative flex flex-col justify-between h-full p-6 min-h-[260px]">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-1.5 flex-wrap">
            <Badge variant={isElite ? "elite" : "field"}>
              {isElite ? "ELITE" : "FIELD"}
            </Badge>
            {isHot && <Badge variant="hot">HOT</Badge>}
            {callWeight > 1 && (
              <Badge variant="active">{callWeight} CALLS/REQ</Badge>
            )}
          </div>

          <div className="text-right shrink-0">
            <div
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: layout === "hero" ? 48 : 32,
                lineHeight: 1,
                letterSpacing: -1,
                color: "var(--ak-ink)",
              }}
            >
              {agent.score > 0 ? agent.score.toFixed(1) : "—"}
            </div>
            <div
              className="mt-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                letterSpacing: 1.5,
                color: "var(--ak-ink3)",
              }}
            >
              {agent.score > 0 ? "FIELD SCORE" : "SCORE PENDING"}
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="my-5 h-1 relative" style={{ background: "var(--ak-paper-deep)" }}>
          <div
            className="absolute top-0 left-0 bottom-0"
            style={{
              width: `${agent.score > 0 ? Math.min(100, agent.score * 10) : 100}%`,
              background: agent.score > 0 ? "var(--ak-signal)" : "repeating-linear-gradient(90deg, var(--ak-rule) 0 4px, transparent 4px 8px)",
            }}
          />
        </div>

        {/* Bottom info */}
        <div>
          <div
            className="mb-2"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: 2,
              color: "var(--ak-ink3)",
            }}
          >
            {formatCategory(agent.category).toUpperCase()}
          </div>

          <h3
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: nameSize,
              lineHeight: 0.9,
              letterSpacing: -1.5,
              color: "var(--ak-ink)",
            }}
          >
            {agent.name}
          </h3>

          {showDescription && (
            <p
              className="mt-3 max-w-md line-clamp-2"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                lineHeight: 1.5,
                color: "var(--ak-ink2)",
              }}
            >
              {agent.description}
            </p>
          )}

          {/* Stats */}
          <div
            className="mt-4 flex items-center gap-4 flex-wrap"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 0.8,
              color: "var(--ak-ink3)",
            }}
          >
            <span>
              <span style={{ color: "var(--ak-ink)" }}>{agent.latency}</span>ms
            </span>
            <span>
              <span style={{ color: "var(--ak-ink)" }}>{formatCalls(agent.totalCalls)}</span> ops
            </span>
            <span style={{ color: agent.trendDelta > 0 ? "var(--ak-signal-deep)" : agent.trendDelta < 0 ? "var(--ak-stamp)" : "var(--ak-ink3)" }}>
              {agent.trendDelta > 0 ? "▲" : agent.trendDelta < 0 ? "▼" : "◆"}{" "}
              {agent.trendDelta > 0 ? "+" : ""}
              {agent.trendDelta}
            </span>
            <span>
              <span style={{ color: "var(--ak-ink)" }}>${(agent.pricePerCall / 100).toFixed(2)}</span>/call
            </span>
          </div>

          {/* Tags */}
          {agent.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {agent.tags.slice(0, layout === "hero" ? 6 : 4).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: 0.8,
                    border: "1px solid var(--ak-rule)",
                    color: "var(--ak-ink2)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
