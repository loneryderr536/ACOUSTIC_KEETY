"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Zap,
  Shield,
  BarChart3,
  DollarSign,
  LogOut,
  Lock,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { Reticle } from "@/components/Reticle";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DashboardStats {
  plan: string;
  planLabel: string;
  callsUsed: number;
  callsLimit: number;
  callsBalance: number;
  dailyAllowance: number;
  dailyCeiling: number;
  callsRemaining: number;
  percentUsed: number;
}

interface CallRecord {
  callId: string;
  agentSlug: string;
  agentName: string;
  routingStrategy?: string;
  latencyMs: number | null;
  status: string;
  costCents: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function centsToUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function maskKey(key: string): string {
  if (key.length <= 10) return key.slice(0, 4) + "..." + key.slice(-3);
  return key.slice(0, 8) + "..." + key.slice(-4);
}

function relativeTime(isoStr: string): string {
  const now = Date.now();
  const then = new Date(isoStr).getTime();
  const diffS = Math.floor((now - then) / 1000);
  if (diffS < 60) return `${diffS}s ago`;
  const diffM = Math.floor(diffS / 60);
  if (diffM < 60) return `${diffM} min ago`;
  const diffH = Math.floor(diffM / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d ago`;
}

function statusColor(status: string) {
  switch (status) {
    case "success":
      return "text-[var(--ak-signal-deep)]";
    case "error":
      return "text-[var(--ak-stamp)]";
    case "timeout":
      return "text-[#b2831a]";
    default:
      return "text-[var(--ak-ink2)]";
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "success":
      return "text-[var(--ak-signal-deep)] border-[var(--ak-signal-deep)] bg-[rgba(198,255,46,0.08)]";
    case "error":
      return "text-[var(--ak-stamp)] border-[var(--ak-stamp)] bg-[rgba(178,58,42,0.06)]";
    case "timeout":
      return "text-[#b2831a] border-[#b2831a] bg-[rgba(178,131,26,0.08)]";
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
  children,
}: {
  icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
  label: string;
  value: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="p-6 border-r border-b"
      style={{ borderColor: "var(--ak-rule)" }}
    >
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
      {children}
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
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function DashboardClient() {
  const searchParams = useSearchParams();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upgraded, setUpgraded] = useState(false);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [copied, setCopied] = useState(false);
  const usageToastShown = useRef(false);

  /* -- Bootstrap key from localStorage -- */
  useEffect(() => {
    const stored = localStorage.getItem("hoa_subscriber_key");
    if (stored) {
      setApiKey(stored);
    } else {
      setLoading(false);
    }
  }, []);

  /* -- Handle post-payment redirect -- */
  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      setUpgraded(true);
      // Refetch after short delay to let webhook process
      const timer = setTimeout(() => {
        if (apiKey) fetchData(apiKey);
      }, 2000);
      // Auto-dismiss banner after 8 seconds
      const dismiss = setTimeout(() => setUpgraded(false), 8000);
      return () => { clearTimeout(timer); clearTimeout(dismiss); };
    }
  }, [searchParams, apiKey]); // eslint-disable-line react-hooks/exhaustive-deps

  /* -- Fetch data whenever apiKey changes -- */
  const fetchData = useCallback(async (key: string) => {
    setLoading(true);
    setError("");
    try {
      const headers = { Authorization: `Bearer ${key}` };
      const [statsRes, callsRes] = await Promise.all([
        fetch("/api/dashboard/stats", { headers }),
        fetch("/api/dashboard/calls?limit=20", { headers }),
      ]);

      if (statsRes.status === 401 || callsRes.status === 401) {
        localStorage.removeItem("hoa_subscriber_key");
        setApiKey(null);
        setError("INVALID CREDENTIALS -- ACCESS DENIED");
        setLoading(false);
        return;
      }

      if (!statsRes.ok || !callsRes.ok) {
        throw new Error("Failed to fetch dashboard data");
      }

      const statsData = await statsRes.json();
      const callsData = await callsRes.json();
      setStats(statsData);
      setCalls(callsData.calls ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (apiKey) fetchData(apiKey);
  }, [apiKey, fetchData]);

  /* -- Usage threshold toasts (once per page load) -- */
  useEffect(() => {
    if (!stats || usageToastShown.current) return;
    const pct = stats.callsLimit > 0 ? (stats.callsUsed / stats.callsLimit) * 100 : 0;

    if (pct >= 95) {
      toast.warning('Almost at your credit limit — consider upgrading.', {
        description: `${Math.max(0, stats.callsLimit - stats.callsUsed).toLocaleString()} credits remaining.`,
      });
      usageToastShown.current = true;
    } else if (pct >= 80) {
      toast.info(`You've used ${Math.round(pct)}% of your monthly credits.`, {
        description: `${Math.max(0, stats.callsLimit - stats.callsUsed).toLocaleString()} credits remaining.`,
      });
      usageToastShown.current = true;
    }
  }, [stats]);

  /* -- Handlers -- */
  function handleSubmitKey(e: React.FormEvent) {
    e.preventDefault();
    if (!keyInput.trim()) return;
    const key = keyInput.trim();
    localStorage.setItem("hoa_subscriber_key", key);
    setApiKey(key);
    setKeyInput("");
  }

  function handleLogout() {
    localStorage.removeItem("hoa_subscriber_key");
    setApiKey(null);
    setStats(null);
    setCalls([]);
    setError("");
  }

  function handleCopyKey() {
    if (!apiKey) return;
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Key Entry                                                */
  /* ---------------------------------------------------------------- */

  if (!apiKey && !loading) {
    return (
      <>
        <section
          style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
          className="px-8 sm:px-14 pt-20 pb-12"
        >
          <div
            className="flex justify-between mb-8"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: 2,
              color: "var(--ak-ink3)",
            }}
          >
            <span>FILE NO. AK—DASH/SUB</span>
            <span>◆ SUBSCRIBER COMMAND CENTER</span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(52px, 8vw, 120px)",
              lineHeight: 0.9,
              letterSpacing: -3.5,
              color: "var(--ak-ink)",
            }}
          >
            Dashboard.
          </h1>
          <p
            className="mt-4"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 1.8,
              color: "var(--ak-ink3)",
              textTransform: "uppercase",
            }}
          >
            AUTHENTICATE TO ACCESS SUBSCRIBER OPERATIONS
          </p>
        </section>

        <section style={paperBg} className="px-8 sm:px-14 py-20">
          <div className="max-w-lg mx-auto">
            <div
              className="border p-8"
              style={{ borderColor: "var(--ak-ink)", background: "var(--ak-paper-light)" }}
            >
              <div
                className="flex justify-between mb-6"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: "var(--ak-ink3)",
                }}
              >
                <span>/SUBSCRIBER CREDENTIALS</span>
                <Lock size={12} style={{ color: "var(--ak-ink3)" }} />
              </div>

              <form onSubmit={handleSubmitKey}>
                <label
                  className="block mb-2"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: 1.5,
                    color: "var(--ak-ink3)",
                  }}
                >
                  01 &nbsp; API KEY
                </label>
                <input
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="ak_live_..."
                  className="w-full px-4 py-3 focus:outline-none mb-4"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 14,
                    background: "var(--ak-paper)",
                    border: "1px solid var(--ak-ink)",
                    color: "var(--ak-ink)",
                  }}
                />
                <button
                  type="submit"
                  className="w-full py-3 cursor-pointer"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: 500,
                    letterSpacing: 2,
                    background: "var(--ak-signal)",
                    color: "var(--ak-ink)",
                    border: "1px solid var(--ak-ink)",
                    textTransform: "uppercase",
                  }}
                >
                  AUTHENTICATE
                </button>
              </form>

              {error && (
                <div className="mt-4 flex items-center gap-2">
                  <AlertTriangle size={12} style={{ color: "var(--ak-stamp)" }} />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: 1.5,
                      color: "var(--ak-stamp)",
                      textTransform: "uppercase",
                    }}
                  >
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
        <section
          style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
          className="px-8 sm:px-14 pt-20 pb-12"
        >
          <div
            className="flex justify-between mb-8"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: 2,
              color: "var(--ak-ink3)",
            }}
          >
            <span>FILE NO. AK—DASH/SUB</span>
            <span>◆ SUBSCRIBER COMMAND CENTER</span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(52px, 8vw, 120px)",
              lineHeight: 0.9,
              letterSpacing: -3.5,
              color: "var(--ak-ink)",
            }}
          >
            Dashboard.
          </h1>
        </section>
        <section style={paperBg} className="flex flex-col items-center justify-center py-32 px-8">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: 2.5,
              color: "var(--ak-ink3)",
              textTransform: "uppercase",
            }}
          >
            DECRYPTING TRANSMISSION...
          </span>
        </section>
      </>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Render: Dashboard                                                */
  /* ---------------------------------------------------------------- */

  const pillBtn = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 2,
    padding: "8px 14px",
    color: "var(--ak-ink)",
    background: "transparent",
    border: "1px solid var(--ak-ink)",
    textTransform: "uppercase" as const,
    cursor: "pointer",
  };

  return (
    <>
      {/* ---- HERO ---- */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 pt-20 pb-12"
      >
        <div
          className="flex justify-between mb-8"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--ak-ink3)",
          }}
        >
          <span>FILE NO. AK—DASH/SUB</span>
          <span>◆ SUBSCRIBER COMMAND CENTER</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(52px, 8vw, 120px)",
                lineHeight: 0.9,
                letterSpacing: -3.5,
                color: "var(--ak-ink)",
              }}
            >
              Dashboard.
            </h1>
            <p
              className="mt-3"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: 1.8,
                color: "var(--ak-ink3)",
                textTransform: "uppercase",
              }}
            >
              MONITOR USAGE / MANAGE KEYS / REVIEW TRANSMISSIONS
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className="hidden sm:inline mr-2"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 1.5,
                color: "var(--ak-ink3)",
              }}
            >
              {apiKey ? maskKey(apiKey) : ""}
            </span>
            <Link href="/provider/dashboard" style={pillBtn}>
              PROVIDER HQ
            </Link>
            {stats && stats.plan !== "explorer" && stats.plan !== "recruit" && (
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/stripe/portal", {
                      method: "POST",
                      headers: { Authorization: `Bearer ${apiKey}` },
                    });
                    const data = await res.json();
                    if (data.url) window.location.href = data.url;
                  } catch { /* ignore */ }
                }}
                style={pillBtn}
              >
                MANAGE PLAN
              </button>
            )}
            <button
              onClick={handleLogout}
              style={pillBtn}
              className="inline-flex items-center gap-2"
            >
              <LogOut size={11} /> LOG OUT
            </button>
          </div>
        </div>
      </section>

      {/* ---- ERROR ---- */}
      {error && (
        <div style={paperBg} className="px-8 sm:px-14 pt-6">
          <div
            className="border px-4 py-3 flex items-center gap-2"
            style={{ borderColor: "var(--ak-stamp)", background: "rgba(178,58,42,0.06)" }}
          >
            <AlertTriangle size={14} style={{ color: "var(--ak-stamp)" }} />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 1.5,
                color: "var(--ak-stamp)",
                textTransform: "uppercase",
              }}
            >
              {error}
            </span>
          </div>
        </div>
      )}

      {/* ---- UPGRADE SUCCESS BANNER ---- */}
      {upgraded && (
        <div style={paperBg} className="px-8 sm:px-14 pt-6">
          <div
            className="border px-4 py-3 flex items-center justify-between"
            style={{ borderColor: "var(--ak-signal-deep)", background: "rgba(198,255,46,0.08)" }}
          >
            <div className="flex items-center gap-2">
              <CheckCircle size={14} style={{ color: "var(--ak-signal-deep)" }} />
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1.8,
                  color: "var(--ak-ink)",
                  textTransform: "uppercase",
                }}
              >
                PLAN UPGRADED SUCCESSFULLY — WELCOME TO {stats ? stats.planLabel : "YOUR NEW PLAN"}
              </span>
            </div>
            <button
              onClick={() => setUpgraded(false)}
              className="cursor-pointer"
              style={{ color: "var(--ak-ink3)", fontSize: 16 }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* ---- NEW USER BANNER ---- */}
      {stats && stats.callsUsed === 0 && (
        <div style={paperBg} className="px-8 sm:px-14 pt-6">
          <Link
            href="/getting-started"
            className="block border px-4 py-3 hover:opacity-80 transition-opacity"
            style={{ borderColor: "var(--ak-signal-deep)", background: "rgba(198,255,46,0.08)" }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 1.5,
                color: "var(--ak-ink)",
                textTransform: "uppercase",
              }}
            >
              Haven&apos;t made your first call yet? Read the quick start guide →
            </span>
          </Link>
        </div>
      )}

      {/* ---- CONTENT ---- */}
      <section style={paperBg} className="px-8 sm:px-14 py-14">
        <div className="max-w-7xl mx-auto">
          {/* Stat cards */}
          {stats && (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-l border-t mb-12"
              style={{ borderColor: "var(--ak-rule)" }}
            >
              <StatCard
                icon={Shield}
                label="Plan"
                value={stats.planLabel}
                sub="Clearance level"
              />
              <StatCard
                icon={Zap}
                label="Credit Balance"
                value={stats.callsBalance.toLocaleString()}
                sub="Credits available (1 credit = $0.01)"
              >
                {/* Balance bar: balance relative to daily ceiling */}
                <div className="mt-4 h-1 w-full overflow-hidden" style={{ background: "var(--ak-paper-deep)" }}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, stats.dailyCeiling > 0 ? (stats.callsBalance / stats.dailyCeiling) * 100 : 0)}%`,
                      background: "var(--ak-signal)",
                    }}
                  />
                </div>
              </StatCard>
              <StatCard
                icon={BarChart3}
                label="Daily Replenish"
                value={`+${stats.dailyAllowance.toLocaleString()}`}
                sub={`Ceiling: ${stats.dailyCeiling.toLocaleString()} credits / day`}
              />
              <StatCard
                icon={DollarSign}
                label="Credits Used"
                value={stats.callsUsed.toLocaleString()}
                sub={`of ${stats.callsLimit.toLocaleString()} this cycle`}
              >
                {/* Usage progress bar */}
                <div className="mt-4 h-1 w-full overflow-hidden" style={{ background: "var(--ak-paper-deep)" }}>
                  <div
                    className="h-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, stats.percentUsed)}%`,
                      background: "var(--ak-signal)",
                    }}
                  />
                </div>
              </StatCard>
            </div>
          )}

          {/* Recent Calls Table */}
          <div className="mb-12">
            <div
              className="mb-4 flex items-baseline justify-between"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 2,
                color: "var(--ak-ink3)",
              }}
            >
              <span>/01 · RECENT TRANSMISSIONS</span>
            </div>

            <div className="border overflow-x-auto" style={{ borderColor: "var(--ak-rule)" }}>
              <table className="w-full" style={{ minWidth: 600 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--ak-rule)" }}>
                    {["TIME", "AGENT", "STATUS", "LATENCY", "COST"].map((h) => (
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
                  {calls.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center">
                        <p
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            letterSpacing: 2.5,
                            color: "var(--ak-ink3)",
                            textTransform: "uppercase",
                          }}
                        >
                          NO TRANSMISSIONS LOGGED
                        </p>
                        <p
                          className="mt-2"
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 14,
                            color: "var(--ak-ink3)",
                          }}
                        >
                          Make API calls to see your history here.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    calls.map((call) => (
                      <tr
                        key={call.callId}
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
                          {relativeTime(call.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/agents/${call.agentSlug}`}
                            className="hover:opacity-70 transition-opacity"
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 12,
                              color: "var(--ak-ink)",
                            }}
                          >
                            {call.agentSlug}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 border ${statusBadgeClass(call.status)}`}
                            style={{
                              fontFamily: "var(--font-mono)",
                              fontSize: 9,
                              letterSpacing: 2,
                              textTransform: "uppercase",
                            }}
                          >
                            {call.status}
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 ${statusColor(call.status)}`}
                          style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                        >
                          {call.latencyMs != null ? `${call.latencyMs}ms` : "--"}
                        </td>
                        <td
                          className="px-4 py-3"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            color: "var(--ak-ink2)",
                          }}
                        >
                          {centsToUsd(call.costCents)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* API Access Section */}
          {apiKey && (
            <div>
              <div
                className="mb-4 flex items-baseline justify-between"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: "var(--ak-ink3)",
                }}
              >
                <span>/02 · API ACCESS</span>
                <span>◆ YOUR API KEY</span>
              </div>

              <div
                className="border p-6"
                style={{ borderColor: "var(--ak-rule)", background: "var(--ak-paper-light)" }}
              >
                {/* Masked key + copy */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="flex-1 px-4 py-2.5 truncate"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 14,
                      background: "var(--ak-paper)",
                      border: "1px solid var(--ak-ink)",
                      color: "var(--ak-ink)",
                    }}
                  >
                    {maskKey(apiKey)}
                  </div>
                  <button
                    onClick={handleCopyKey}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 cursor-pointer"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: 2,
                      background: copied ? "var(--ak-signal)" : "transparent",
                      color: "var(--ak-ink)",
                      border: "1px solid var(--ak-ink)",
                      textTransform: "uppercase",
                    }}
                  >
                    {copied ? (
                      <>
                        <Check size={12} /> COPIED
                      </>
                    ) : (
                      <>
                        <Copy size={12} /> COPY
                      </>
                    )}
                  </button>
                </div>

                <p
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    color: "var(--ak-ink3)",
                  }}
                >
                  Need to integrate programmatically?{" "}
                  <Link href="/reference" className="underline" style={{ color: "var(--ak-ink)" }}>
                    See the API reference →
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
