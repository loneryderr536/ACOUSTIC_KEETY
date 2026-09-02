"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { SearchBar } from "@/components/SearchBar";
import { CategoryPills } from "@/components/CategoryPills";
import { AgentCard } from "@/components/AgentCard";
import { Reticle } from "@/components/Reticle";
import { Badge } from "@/components/Badge";
import { MODEL_TIER_WEIGHTS } from "@/lib/plans";

const CATEGORIES = [
  "All",
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
  if (slug === "All") return "All";
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function formatCalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface AgentData {
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

export function LeaderboardClient({
  agents,
  totalCount,
}: {
  agents: AgentData[];
  totalCount: number;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedAgent, setSelectedAgent] = useState<AgentData | null>(null);

  const categoryLabels = CATEGORIES.map(formatCategory);

  const filtered = useMemo(() => {
    let result = agents;

    if (category !== "All") {
      result = result.filter((a) => a.category === category);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.author.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    return result;
  }, [agents, category, search]);

  const getLayout = useCallback(
    (index: number): "hero" | "wide" | "normal" => {
      if (index === 0) return "hero";
      if (index === 3) return "wide";
      return "normal";
    },
    []
  );

  const handleSelect = useCallback((agent: AgentData) => {
    setSelectedAgent(agent);
  }, []);

  const closeModal = useCallback(() => {
    setSelectedAgent(null);
  }, []);

  return (
    <>
      {/* Search + Filter */}
      <div className="space-y-4 mb-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[8px] tracking-[0.4em] uppercase text-zinc-600">
              DOSSIERS
            </span>
            <span className="text-[8px] tracking-[0.3em] uppercase text-zinc-700">
              / {filtered.length} OF {totalCount} OPERATIVES
            </span>
          </div>
        </div>

        <SearchBar search={search} onSearchChange={setSearch} />

        <CategoryPills
          categories={categoryLabels}
          selected={formatCategory(category)}
          onSelect={(label) => {
            const idx = categoryLabels.indexOf(label);
            setCategory(CATEGORIES[idx] ?? "All");
          }}
        />
      </div>

      {/* Agent Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-[2px]">
        {filtered.map((agent, i) => (
          <AgentCard
            key={agent.id}
            agent={agent}
            index={i}
            layout={getLayout(i)}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-20">
          <Reticle size={32} className="text-zinc-800 mx-auto mb-4" />
          <p className="text-[9px] tracking-[0.4em] uppercase text-zinc-600">
            NO OPERATIVES MATCH YOUR CRITERIA
          </p>
        </div>
      )}

      {/* ---- AGENT MODAL ---- */}
      {selectedAgent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />

          {/* Modal */}
          <div
            className="relative w-full max-w-2xl border border-white/[0.06] bg-zinc-950 overflow-hidden"
            style={{ animation: "modalIn 0.3s ease-out" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top gradient */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-500" />

            <div className="p-8">
              {/* Close */}
              <button
                onClick={closeModal}
                className="absolute top-4 right-4 text-zinc-600 hover:text-white transition-colors text-xs tracking-[0.3em] cursor-pointer"
              >
                [CLOSE]
              </button>

              {/* Classification */}
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[7px] tracking-[0.5em] uppercase text-emerald-500">
                  CLASSIFIED DOSSIER
                </span>
                {selectedAgent.verified && (
                  <Badge variant="elite">VERIFIED</Badge>
                )}
              </div>

              {/* Name + Score */}
              <div className="flex items-start justify-between mb-4">
                <h2
                  className="text-5xl text-white leading-[0.9]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {selectedAgent.name}
                </h2>
                <div className="flex items-center gap-2">
                  <Reticle size={20} className="text-emerald-500/60" />
                  <span
                    className="text-4xl text-white"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {selectedAgent.score > 0 ? selectedAgent.score.toFixed(1) : "—"}
                  </span>
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-2 mb-6">
                <span className="text-[9px] tracking-[0.3em] uppercase text-zinc-500">
                  {selectedAgent.author}
                </span>
                <span className="text-zinc-700">/</span>
                <span className="text-[9px] tracking-[0.3em] uppercase text-emerald-600">
                  {formatCategory(selectedAgent.category)}
                </span>
              </div>

              {/* Description */}
              <p className="text-sm text-zinc-400 leading-relaxed mb-6">
                {selectedAgent.description}
              </p>

              {/* Stats */}
              <div className="grid grid-cols-5 gap-[1px] mb-6">
                {[
                  { label: "SCORE", value: selectedAgent.score > 0 ? selectedAgent.score.toFixed(1) : "PENDING" },
                  { label: "LATENCY", value: `${selectedAgent.latency}ms` },
                  { label: "OPS", value: formatCalls(selectedAgent.totalCalls) },
                  { label: "UPTIME", value: `${selectedAgent.uptime}%` },
                  { label: "WEIGHT", value: `${MODEL_TIER_WEIGHTS[selectedAgent.modelTier ?? "unknown"] ?? 1}x` },
                ].map((stat) => (
                  <div key={stat.label} className="bg-zinc-900/60 p-3">
                    <span className="text-[7px] tracking-[0.5em] uppercase text-zinc-600 block mb-1">
                      {stat.label}
                    </span>
                    <span className="text-lg text-white font-bold" style={{ fontFamily: "var(--font-heading)" }}>
                      {stat.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Tags */}
              {selectedAgent.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-6">
                  {selectedAgent.tags.map((tag) => (
                    <Badge key={tag} variant="field">{tag}</Badge>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3">
                <Link
                  href={`/agents/${selectedAgent.slug}#playground`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold tracking-wider transition-colors"
                >
                  TRY NOW
                </Link>
                <Link
                  href={`/agents/${selectedAgent.slug}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 border border-white/[0.08] text-zinc-400 hover:text-white text-sm tracking-wider transition-colors"
                >
                  VIEW FULL DOSSIER
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
