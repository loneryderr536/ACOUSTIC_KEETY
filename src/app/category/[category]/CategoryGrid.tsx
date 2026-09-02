"use client";

import { AgentCard } from "@/components/AgentCard";
import { useRouter } from "next/navigation";

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

export function CategoryGrid({ agents }: { agents: Agent[] }) {
  const router = useRouter();

  if (agents.length === 0) {
    return (
      <div
        className="text-center py-20 border-t border-b"
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
          NO OPERATIVES IN THIS DIVISION
        </p>
      </div>
    );
  }

  return (
    <div
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-l border-t"
      style={{ borderColor: "var(--ak-rule)" }}
    >
      {agents.map((agent, i) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          index={i}
          layout={i === 0 ? "hero" : i === 3 ? "wide" : "normal"}
          onSelect={() => router.push(`/agents/${agent.slug}`)}
        />
      ))}
    </div>
  );
}
