"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bot,
  BarChart3,
  TrendingUp,
  DollarSign,
  LogOut,
  Lock,
  Pencil,
  X,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { Reticle } from "@/components/Reticle";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Agent {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  status: string;
  endpointUrl: string;
  currentScore: number | null;
  latencyP50: number | null;
  latencyP95: number | null;
  uptime: number | null;
  errorRate: number | null;
  totalCalls: number;
  rating: number | null;
  reviewCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProviderStats {
  totalAgents: number;
  activeAgents: number;
  pendingAgents: number;
  suspendedAgents: number;
  totalCalls: number;
  avgScore: number | null;
  totalRevenue: number;
}

interface PayoutRow {
  id: string;
  periodStart: string;
  periodEnd: string;
  grossCents: number;
  providerShareCents: number;
  callCount: number;
  status: "pending" | "paid" | "skipped" | "failed";
  skipReason: string | null;
  failureReason: string | null;
  stripeTransferId: string | null;
  createdAt: string;
  paidAt: string | null;
}

const CATEGORIES = [
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
  "other",
] as const;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCalls(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function centsToUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "text-[var(--ak-signal-deep)] border-[var(--ak-signal-deep)] bg-[rgba(198,255,46,0.08)]";
    case "pending":
    case "benchmarking":
      return "text-[#b2831a] border-[#b2831a] bg-[rgba(178,131,26,0.08)]";
    case "suspended":
      return "text-[var(--ak-stamp)] border-[var(--ak-stamp)] bg-[rgba(178,58,42,0.06)]";
    default:
      return "text-[var(--ak-ink3)] border-[var(--ak-rule)] bg-transparent";
  }
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="p-6 border-r border-b" style={{ borderColor: "var(--ak-rule)" }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} style={{ color: "var(--ak-signal-deep)" }} />
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--ak-ink3)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      </div>
      <div
        style={{
          fontFamily: "var(--font-heading)",
          fontSize: 36,
          lineHeight: 1,
          letterSpacing: -1,
          color: "var(--ak-ink)",
        }}
      >
        {value}
      </div>
      <div
        className="mt-2"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: 1.5,
          color: "var(--ak-ink3)",
          textTransform: "uppercase",
        }}
      >
        {sub}
      </div>
    </div>
  );
}

const paperBg = {
  background: "var(--ak-paper)",
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(0,0,0,0.015) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(0,0,0,0.018) 0%, transparent 40%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")
  `,
};

/* ------------------------------------------------------------------ */
/*  Stripe Connect Card                                                */
/* ------------------------------------------------------------------ */

function StripeConnectCard({ apiKey }: { apiKey: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  async function handleConnect() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/stripe/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
      });
      const data = await res.json();
      if (res.status === 503) {
        setMessage("Stripe Connect is coming soon. During beta, payouts are not yet processed.");
        return;
      }
      if (!res.ok) {
        setMessage(data.error || "Failed to start Stripe Connect setup.");
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] block mb-1">
            PAYOUTS
          </span>
          <p className="text-sm text-[var(--ak-ink2)]">
            Connect your Stripe account to receive payouts from subscriber usage.
          </p>
        </div>
        <button
          onClick={handleConnect}
          disabled={loading}
          className="shrink-0 px-5 py-2.5 bg-[var(--ak-signal)] hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed text-[var(--ak-ink)] text-[9px] tracking-[0.3em] uppercase font-semibold transition-colors cursor-pointer"
        >
          {loading ? "CONNECTING..." : "CONNECT STRIPE"}
        </button>
      </div>

      {message && (
        <p className="text-xs text-amber-400">{message}</p>
      )}

      <button
        onClick={() => setShowDetails(!showDetails)}
        className="text-[9px] tracking-[0.2em] uppercase text-[var(--ak-ink3)] hover:text-[var(--ak-ink2)] transition-colors cursor-pointer"
      >
        {showDetails ? "HIDE DETAILS" : "WHAT TO EXPECT"} {showDetails ? "▲" : "▼"}
      </button>

      {showDetails && (
        <div className="space-y-3 border-t border-white/[0.04] pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[var(--ak-paper)] border border-[var(--ak-rule)] p-4">
              <span className="text-[8px] tracking-[0.3em] uppercase text-[var(--ak-signal-deep)] block mb-1.5">
                WHAT STRIPE COLLECTS
              </span>
              <p className="text-xs text-[var(--ak-ink3)] leading-relaxed">
                Business type, personal identification, and bank account details. Setup takes about 5 minutes. Stripe is PCI Level 1 certified — we never see your banking details.
              </p>
            </div>
            <div className="bg-[var(--ak-paper)] border border-[var(--ak-rule)] p-4">
              <span className="text-[8px] tracking-[0.3em] uppercase text-[var(--ak-signal-deep)] block mb-1.5">
                HOW PAYOUTS WORK
              </span>
              <p className="text-xs text-[var(--ak-ink3)] leading-relaxed">
                Payouts are processed monthly once you reach the $50 minimum withdrawal threshold. Earnings are weighted by call volume and agent quality. See provider terms for the full fee schedule.
              </p>
            </div>
          </div>
          <p className="text-[9px] text-[var(--ak-ink3)]">
            Learn more about provider earnings in our{" "}
            <a href="/getting-started" className="text-[var(--ak-ink)] underline hover:opacity-70">getting started guide</a>
            {" "}or{" "}
            <a href="/reference#payments" className="text-[var(--ak-ink)] underline hover:opacity-70">reference docs</a>.
          </p>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Edit Form                                                          */
/* ------------------------------------------------------------------ */

function EditForm({
  agent,
  apiKey,
  onSaved,
  onCancel,
}: {
  agent: Agent;
  apiKey: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [description, setDescription] = useState(agent.description);
  const [endpointUrl, setEndpointUrl] = useState(agent.endpointUrl);
  const [category, setCategory] = useState(agent.category);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch(`/api/agents/${agent.slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          description,
          endpointUrl,
          category,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setSuccess("AGENT UPDATED SUCCESSFULLY");
      toast.success('Agent updated successfully.');
      setTimeout(() => onSaved(), 800);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      toast.error('Failed to save changes.', { description: errorMessage });
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full bg-[var(--ak-paper)] border border-[var(--ak-ink)] px-3 py-2 text-sm text-[var(--ak-ink)] placeholder:text-[var(--ak-ink3)] focus:outline-none focus:border-[var(--ak-ink)] transition-colors";

  return (
    <div className="border border-[var(--ak-ink)] bg-[var(--ak-paper-light)] p-5 mt-2">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[7px] tracking-[0.5em] uppercase text-[var(--ak-signal-deep)] font-semibold">
          EDIT AGENT PARAMETERS
        </span>
        <button
          onClick={onCancel}
          className="text-[var(--ak-ink3)] hover:text-[var(--ak-ink)] transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-[8px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] block mb-1.5">
            DESCRIPTION
          </label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass + " resize-none"}
          />
        </div>

        <div>
          <label className="text-[8px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] block mb-1.5">
            ENDPOINT URL
          </label>
          <input
            type="url"
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            className={inputClass + " font-mono text-xs"}
          />
        </div>

        <div>
          <label className="text-[8px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] block mb-1.5">
            CATEGORY
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass + " cursor-pointer"}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/-/g, " ").toUpperCase()}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 text-red-400 text-xs">
          <AlertTriangle size={12} />
          <span className="text-[8px] tracking-[0.2em] uppercase">{error}</span>
        </div>
      )}
      {success && (
        <div className="mt-4 flex items-center gap-2 text-[var(--ak-signal-deep)] text-xs">
          <CheckCircle size={12} />
          <span className="text-[8px] tracking-[0.2em] uppercase">
            {success}
          </span>
        </div>
      )}

      <div className="flex items-center gap-3 mt-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2 bg-[var(--ak-signal)] hover:opacity-80 disabled:opacity-40 text-[var(--ak-ink)] text-[9px] tracking-[0.3em] uppercase font-semibold transition-colors cursor-pointer"
        >
          {saving ? "TRANSMITTING..." : "SAVE"}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2 border border-[var(--ak-rule)] text-[var(--ak-ink3)] hover:text-[var(--ak-ink)] text-[9px] tracking-[0.3em] uppercase transition-colors cursor-pointer"
        >
          CANCEL
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function ProviderDashboardClient() {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<ProviderStats | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  /* -- Bootstrap key from localStorage -- */
  useEffect(() => {
    const stored = localStorage.getItem("hoa_provider_key");
    if (stored) {
      setApiKey(stored);
    } else {
      setLoading(false);
    }
  }, []);

  /* -- Fetch data whenever apiKey changes -- */
  const fetchData = useCallback(async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${key}` };
      const [statsRes, agentsRes, payoutsRes] = await Promise.all([
        fetch("/api/provider/stats", { headers }),
        fetch("/api/provider/agents", { headers }),
        fetch("/api/provider/payouts", { headers }),
      ]);

      if (statsRes.status === 401 || agentsRes.status === 401) {
        localStorage.removeItem("hoa_provider_key");
        setApiKey(null);
        setError("INVALID CREDENTIALS -- ACCESS DENIED");
        setLoading(false);
        return;
      }

      if (!statsRes.ok || !agentsRes.ok) {
        throw new Error("Failed to fetch provider data");
      }

      const statsData = await statsRes.json();
      const agentsData = await agentsRes.json();
      setStats(statsData);
      setAgents(agentsData.agents ?? []);

      // Payout history is optional — if the endpoint is down, don't block the dashboard.
      if (payoutsRes.ok) {
        const payoutsData = await payoutsRes.json();
        setPayouts(payoutsData.payouts ?? []);
      } else {
        setPayouts([]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey) fetchData(apiKey);
  }, [apiKey, fetchData]);

  /* -- Handlers -- */
  function handleSubmitKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    const key = keyInput.trim();
    localStorage.setItem("hoa_provider_key", key);
    setApiKey(key);
    setKeyInput("");
  }

  function handleLogout() {
    localStorage.removeItem("hoa_provider_key");
    setApiKey(null);
    setStats(null);
    setAgents([]);
    setError("");
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Key Entry                                                */
  /* ---------------------------------------------------------------- */

  if (!apiKey && !loading) {
    return (
      <>
        <section className="relative min-h-[30vh] flex flex-col justify-end overflow-hidden">
                    <div className="relative z-10 max-w-7xl mx-auto px-4 pb-8 pt-24 w-full">
            <div className="flex items-center gap-2 mb-4">
              <Reticle size={12} className="text-[var(--ak-signal-deep)]" />
              <span className="text-[7px] tracking-[0.5em] uppercase text-[var(--ak-signal-deep)] font-semibold">
                PROVIDER COMMAND CENTER
              </span>
            </div>
            <h1
              className="text-5xl sm:text-6xl text-[var(--ak-ink)] leading-[0.85] tracking-tight mb-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              OPERATIONS HQ
            </h1>
            <p className="text-[9px] tracking-[0.3em] uppercase text-[var(--ak-ink3)]">
              AUTHENTICATE TO ACCESS PROVIDER OPERATIONS
            </p>
          </div>
        </section>

        <section className="relative bg-[var(--ak-paper)]">
          <div className="max-w-xl mx-auto px-4 py-20">
            <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-8">
              <div className="flex items-center gap-2 mb-6">
                <Lock size={14} className="text-[var(--ak-ink3)]" />
                <span className="text-[7px] tracking-[0.5em] uppercase text-[var(--ak-signal-deep)] font-semibold">
                  PROVIDER CREDENTIALS
                </span>
              </div>

              <form onSubmit={handleSubmitKey}>
                <label className="text-[8px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] block mb-2">
                  API KEY
                </label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="ak_live_..."
                  className="w-full bg-[var(--ak-paper)] border border-[var(--ak-ink)] px-4 py-3 text-sm text-[var(--ak-ink)] font-mono placeholder:text-[var(--ak-ink3)] focus:outline-none focus:border-[var(--ak-ink)] transition-colors mb-4"
                />
                <button
                  type="submit"
                  className="w-full py-3 bg-[var(--ak-signal)] hover:opacity-80 text-[var(--ak-ink)] text-[9px] tracking-[0.4em] uppercase font-semibold transition-colors cursor-pointer"
                >
                  AUTHENTICATE
                </button>
              </form>

              {error && (
                <div className="mt-4 flex items-center gap-2 text-red-400">
                  <AlertTriangle size={12} />
                  <span className="text-[8px] tracking-[0.2em] uppercase">
                    {error}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>
      </>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Loading                                                  */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <>
        <section className="relative min-h-[30vh] flex flex-col justify-end overflow-hidden">
                    <div className="relative z-10 max-w-7xl mx-auto px-4 pb-8 pt-24 w-full">
            <div className="flex items-center gap-2 mb-4">
              <Reticle size={12} className="text-[var(--ak-signal-deep)]" />
              <span className="text-[7px] tracking-[0.5em] uppercase text-[var(--ak-signal-deep)] font-semibold">
                PROVIDER COMMAND CENTER
              </span>
            </div>
            <h1
              className="text-5xl sm:text-6xl text-[var(--ak-ink)] leading-[0.85] tracking-tight mb-2"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              OPERATIONS HQ
            </h1>
          </div>
        </section>
        <section className="relative bg-[var(--ak-paper)]">
          <div className="flex flex-col items-center justify-center py-32">
            <div className="animate-spin mb-4">
              <Reticle size={32} className="text-[var(--ak-signal-deep)]" />
            </div>
            <span className="text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)]">
              ESTABLISHING SECURE CONNECTION...
            </span>
          </div>
        </section>
      </>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Dashboard                                                */
  /* ---------------------------------------------------------------- */

  return (
    <>
      {/* ---- HERO ---- */}
      <section className="relative min-h-[30vh] flex flex-col justify-end overflow-hidden">

        <div className="relative z-10 max-w-7xl mx-auto px-4 pb-8 pt-24 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Reticle size={12} className="text-[var(--ak-signal-deep)]" />
                <span className="text-[7px] tracking-[0.5em] uppercase text-[var(--ak-signal-deep)] font-semibold">
                  PROVIDER COMMAND CENTER
                </span>
              </div>

              <h1
                className="text-5xl sm:text-6xl text-[var(--ak-ink)] leading-[0.85] tracking-tight mb-2"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                OPERATIONS HQ
              </h1>

              <p className="text-[9px] tracking-[0.3em] uppercase text-[var(--ak-ink3)]">
                MANAGE YOUR AGENTS / VIEW PERFORMANCE / TRIGGER BENCHMARKS
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="self-start inline-flex items-center gap-2 px-4 py-2 border border-[var(--ak-rule)] text-[var(--ak-ink3)] hover:text-[var(--ak-ink)] hover:border-red-500/30 text-[9px] tracking-[0.3em] uppercase transition-colors cursor-pointer"
            >
              <LogOut size={12} /> LOG OUT
            </button>
          </div>
        </div>
      </section>

      {/* ---- ERROR ---- */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 pt-6">
          <div className="border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-400" />
            <span className="text-[8px] tracking-[0.2em] uppercase text-red-400">
              {error}
            </span>
          </div>
        </div>
      )}

      {/* ---- CONTENT ---- */}
      <section className="relative bg-[var(--ak-paper)]">
        <div className="max-w-7xl mx-auto px-4 py-12">
          {/* Stat cards */}
          {stats && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-[1px] mb-12">
              <StatCard
                icon={Bot}
                label="Agents"
                value={String(stats.totalAgents)}
                sub={`${stats.activeAgents} active`}
              />
              <StatCard
                icon={BarChart3}
                label="Avg Score"
                value={
                  stats.avgScore != null ? stats.avgScore.toFixed(1) : "--"
                }
                sub="Across active agents"
              />
              <StatCard
                icon={TrendingUp}
                label="Total Ops"
                value={formatCalls(stats.totalCalls)}
                sub="All time operations"
              />
              <StatCard
                icon={DollarSign}
                label="Revenue"
                value={centsToUsd(stats.totalRevenue)}
                sub="Total earnings"
              />
            </div>
          )}

          {/* Stripe Connect */}
          <div className="mb-12">
            <StripeConnectCard apiKey={apiKey!} />
          </div>

          {/* Payout history */}
          <div className="mb-12">
            <span className="text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] block mb-4">
              PAYOUT HISTORY
            </span>
            {payouts.length === 0 ? (
              <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-6">
                <p className="text-[9px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] mb-2">
                  NO PAYOUTS YET
                </p>
                <p className="text-xs text-[var(--ak-ink3)] leading-relaxed">
                  Payouts appear here once your earnings reach the $50 minimum threshold
                  and the monthly runner processes the period. Successful API calls to your
                  agents contribute to the next payout cycle.
                </p>
              </div>
            ) : (
              <div className="border border-[var(--ak-rule)] overflow-x-auto">
                <table className="w-full" style={{ minWidth: 640 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--ak-rule)" }}>
                      {["PERIOD END", "CALLS", "GROSS", "YOUR SHARE", "STATUS", "REF"].map((h) => (
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
                    {payouts.map((p) => {
                      const periodEnd = new Date(p.periodEnd);
                      const statusColor =
                        p.status === "paid"
                          ? "var(--ak-signal-deep)"
                          : p.status === "failed"
                            ? "var(--ak-stamp)"
                            : p.status === "skipped"
                              ? "var(--ak-ink3)"
                              : "var(--ak-ink2)";
                      const ref = p.stripeTransferId
                        ? p.stripeTransferId
                        : p.skipReason ?? p.failureReason ?? "—";
                      return (
                        <tr
                          key={p.id}
                          style={{ borderBottom: "1px solid var(--ak-rule-soft)" }}
                        >
                          <td
                            className="px-4 py-3"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              color: "var(--ak-ink)",
                            }}
                          >
                            {periodEnd.toISOString().slice(0, 10)}
                          </td>
                          <td
                            className="px-4 py-3"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              color: "var(--ak-ink2)",
                            }}
                          >
                            {p.callCount}
                          </td>
                          <td
                            className="px-4 py-3"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              color: "var(--ak-ink2)",
                            }}
                          >
                            ${(p.grossCents / 100).toFixed(2)}
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
                            ${(p.providerShareCents / 100).toFixed(2)}
                          </td>
                          <td
                            className="px-4 py-3"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              letterSpacing: 1.5,
                              color: statusColor,
                              textTransform: "uppercase",
                            }}
                          >
                            {p.status}
                          </td>
                          <td
                            className="px-4 py-3"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 10,
                              color: "var(--ak-ink3)",
                            }}
                          >
                            {ref}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Agents list */}
          <div className="mb-12">
            <span className="text-[8px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] block mb-4">
              REGISTERED AGENTS
            </span>

            {agents.length === 0 ? (
              <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-12 text-center">
                <Bot size={32} className="text-zinc-800 mx-auto mb-4" />
                <p className="text-[9px] tracking-[0.4em] uppercase text-[var(--ak-ink3)] mb-2">
                  NO AGENTS REGISTERED
                </p>
                <p className="text-sm text-[var(--ak-ink3)]">
                  Register your first agent to begin operations.
                </p>
              </div>
            ) : (
              <div className="space-y-[1px]">
                {agents.map((agent) => (
                  <div key={agent.id}>
                    <div className="border border-[var(--ak-rule)] bg-[var(--ak-paper-light)] p-5">
                      <div className="flex items-start justify-between gap-4">
                        {/* Left side */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3
                              className="text-lg text-[var(--ak-ink)] leading-none"
                              style={{
                                fontFamily: "var(--font-heading)",
                              }}
                            >
                              {agent.name}
                            </h3>
                            <span
                              className={`text-[7px] tracking-[0.3em] uppercase px-2 py-0.5 border ${statusColor(agent.status)}`}
                            >
                              {agent.status}
                            </span>
                          </div>

                          {/* Metrics row */}
                          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-3">
                            <div>
                              <span className="text-[7px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] block">
                                SCORE
                              </span>
                              <span className="text-sm text-[var(--ak-ink)] font-mono">
                                {agent.currentScore != null
                                  ? agent.currentScore.toFixed(1)
                                  : "--"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[7px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] block">
                                LATENCY
                              </span>
                              <span className="text-sm text-[var(--ak-ink)] font-mono">
                                {agent.latencyP50 != null
                                  ? `${agent.latencyP50}ms`
                                  : "--"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[7px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] block">
                                CALLS
                              </span>
                              <span className="text-sm text-[var(--ak-ink)] font-mono">
                                {formatCalls(agent.totalCalls)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[7px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] block">
                                ERROR RATE
                              </span>
                              <span className="text-sm text-[var(--ak-ink)] font-mono">
                                {agent.errorRate != null
                                  ? `${agent.errorRate.toFixed(1)}%`
                                  : "--"}
                              </span>
                            </div>
                            <div>
                              <span className="text-[7px] tracking-[0.3em] uppercase text-[var(--ak-ink3)] block">
                                PRICE
                              </span>
                              <span className="text-sm text-[var(--ak-ink2)] font-mono">
                                Platform pricing
                              </span>
                            </div>
                          </div>

                          {/* Endpoint */}
                          <div className="font-mono text-[11px] text-[var(--ak-ink3)] truncate max-w-lg">
                            {agent.endpointUrl}
                          </div>
                        </div>

                        {/* Right side: actions */}
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() =>
                              setEditingSlug(
                                editingSlug === agent.slug
                                  ? null
                                  : agent.slug
                              )
                            }
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--ak-rule)] text-[var(--ak-ink3)] hover:text-[var(--ak-signal-deep)] hover:border-[var(--ak-signal-deep)] text-[8px] tracking-[0.3em] uppercase transition-colors cursor-pointer"
                          >
                            <Pencil size={10} /> EDIT
                          </button>
                          <Link
                            href={`/agents/${agent.slug}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[var(--ak-rule)] text-[var(--ak-ink3)] hover:text-[var(--ak-ink)] text-[8px] tracking-[0.3em] uppercase transition-colors"
                          >
                            VIEW
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Inline Edit Form */}
                    {editingSlug === agent.slug && apiKey && (
                      <EditForm
                        agent={agent}
                        apiKey={apiKey}
                        onSaved={() => {
                          setEditingSlug(null);
                          fetchData(apiKey);
                        }}
                        onCancel={() => setEditingSlug(null)}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
