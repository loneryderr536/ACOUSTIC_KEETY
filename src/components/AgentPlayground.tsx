"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { useSubscriber } from "@/lib/useSubscriber";

interface Props {
  agentSlug: string;
  agentName: string;
}

interface RunResult {
  call_id: string;
  agent: string;
  agent_name: string;
  routing_strategy: string;
  result: Record<string, unknown>;
  latency_ms: number;
  status: string;
  cost_cents: number;
}

const classifiedBg = {
  background: "var(--ak-classified)",
  backgroundImage: `
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.03 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")
  `,
};

export function AgentPlayground({ agentSlug, agentName }: Props) {
  const { apiKey, isSignedIn, signOut } = useSubscriber();
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");

  async function handleRun() {
    if (!task.trim() || !apiKey) return;
    setError("");
    setResult(null);
    setRunning(true);

    try {
      const res = await fetch("/api/v1/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          agent: agentSlug,
          task: task.trim(),
          routing: "specific",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          signOut();
          setError("Your session has expired. Please sign in again.");
        } else if (res.status === 429) {
          setError(
            "You've used all your free calls this month. Upgrade your plan for more."
          );
        } else if (res.status === 403) {
          setError(
            "This request was blocked by our security scan. Please rephrase your task."
          );
        } else {
          setError(data.error || "Something went wrong. Please try again.");
        }
        return;
      }

      setResult(data);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setRunning(false);
    }
  }

  function formatResult(res: Record<string, unknown>): string {
    return JSON.stringify(res, null, 2);
  }

  function getSummary(res: Record<string, unknown>): string | null {
    if (typeof res.summary === "string") return res.summary;
    if (typeof res.message === "string") return res.message;
    if (typeof res.answer === "string") return res.answer;
    if (typeof res.output === "string") return res.output;
    return null;
  }

  const monoLabel = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    letterSpacing: 2,
    color: "var(--ak-ink3)",
  } as const;

  return (
    <div className="scroll-mt-20">
      <div
        className="mb-6 flex items-baseline justify-between"
        style={monoLabel}
      >
        <span>/06 · TEST THIS AGENT</span>
        <span>◆ PLAYGROUND</span>
      </div>

      <div
        className="border p-7"
        style={{ borderColor: "var(--ak-rule)", background: "var(--ak-paper-light)" }}
      >
        {!isSignedIn ? (
          /* ── Not signed in ── */
          <div className="text-center py-10">
            <p
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 32,
                letterSpacing: -0.6,
                color: "var(--ak-ink)",
              }}
              className="mb-2"
            >
              Create a free account to test <span className="italic">{agentName}</span> right here in your browser.
            </p>
            <p
              className="mb-8"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                color: "var(--ak-ink3)",
              }}
            >
              500 free calls per month. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href={`/signup?redirect=/agents/${agentSlug}#playground`}
                className="px-6 py-3.5 text-sm font-medium"
                style={{
                  fontFamily: "var(--font-sans)",
                  background: "var(--ak-signal)",
                  color: "var(--ak-ink)",
                  border: "1px solid var(--ak-ink)",
                }}
              >
                SIGN UP TO TRY ↗
              </Link>
              <Link
                href="/dashboard"
                className="hover:opacity-70 transition-opacity"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: 1.5,
                  color: "var(--ak-ink3)",
                }}
              >
                Already have an API key? Sign in
              </Link>
            </div>
          </div>
        ) : !result && !error ? (
          /* ── Ready / Running ── */
          <div className="space-y-5">
            <div>
              <label className="block mb-2" style={monoLabel}>
                MISSION BRIEFING
              </label>
              <textarea
                value={task}
                onChange={(e) => setTask(e.target.value)}
                placeholder={`Describe what you want ${agentName} to do...`}
                rows={4}
                className="w-full px-3 py-2.5 focus:outline-none resize-none"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  background: "var(--ak-paper)",
                  border: "1px solid var(--ak-ink)",
                  color: "var(--ak-ink)",
                }}
              />
              <p
                className="mt-2"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1.2,
                  color: "var(--ak-ink3)",
                }}
              >
                This will use 1 API call from your free plan (500/month)
              </p>
            </div>

            <button
              onClick={handleRun}
              disabled={running || !task.trim()}
              className="px-6 py-3.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              style={{
                fontFamily: "var(--font-sans)",
                background: "var(--ak-signal)",
                color: "var(--ak-ink)",
                border: "1px solid var(--ak-ink)",
              }}
            >
              {running ? "EXECUTING..." : "RUN AGENT ↗"}
            </button>
          </div>
        ) : error ? (
          /* ── Error state ── */
          <div className="space-y-4">
            <div
              className="border p-4"
              style={{
                borderColor: "var(--ak-stamp)",
                background: "rgba(178,58,42,0.06)",
              }}
            >
              <div
                className="mb-1"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: "var(--ak-stamp)",
                }}
              >
                MISSION FAILED
              </div>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  color: "var(--ak-ink)",
                }}
              >
                {error}
              </p>
              {error.includes("expired") && (
                <Link
                  href={`/signup?redirect=/agents/${agentSlug}#playground`}
                  className="mt-2 inline-block underline"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    color: "var(--ak-ink)",
                  }}
                >
                  Sign up again
                </Link>
              )}
              {error.includes("Upgrade") && (
                <Link
                  href="/pricing"
                  className="mt-2 inline-block underline"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    color: "var(--ak-ink)",
                  }}
                >
                  View pricing
                </Link>
              )}
            </div>
            <button
              onClick={() => {
                setError("");
                setResult(null);
              }}
              className="px-5 py-3 text-sm font-medium"
              style={{
                fontFamily: "var(--font-sans)",
                background: "transparent",
                color: "var(--ak-ink)",
                border: "1px solid var(--ak-ink)",
              }}
            >
              TRY AGAIN
            </button>
          </div>
        ) : result ? (
          /* ── Success result ── */
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <Badge variant={result.status === "success" ? "active" : "hot"}>
                {result.status.toUpperCase()}
              </Badge>
              <div
                className="flex items-center gap-5"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1.5,
                  color: "var(--ak-ink3)",
                }}
              >
                <span>
                  LATENCY{" "}
                  <span style={{ color: "var(--ak-ink)" }}>{result.latency_ms}ms</span>
                </span>
                <span>
                  COST{" "}
                  <span style={{ color: "var(--ak-ink)" }}>
                    ${(result.cost_cents / 100).toFixed(4)}
                  </span>
                </span>
              </div>
            </div>

            {/* Summary (if present) */}
            {getSummary(result.result) && (
              <div
                className="border p-5"
                style={{
                  borderColor: "var(--ak-rule)",
                  background: "var(--ak-paper)",
                }}
              >
                <span
                  className="block mb-2"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: 2,
                    color: "var(--ak-signal-deep)",
                  }}
                >
                  RESPONSE
                </span>
                <p
                  className="whitespace-pre-wrap"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: "var(--ak-ink)",
                  }}
                >
                  {getSummary(result.result)}
                </p>
              </div>
            )}

            {/* Full result — in classified/terminal style */}
            <div
              className="border overflow-hidden"
              style={{ ...classifiedBg, borderColor: "#2a2824" }}
            >
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{ borderBottom: "1px solid #2a2824" }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: 2,
                    color: "#8a8478",
                  }}
                >
                  {getSummary(result.result) ? "RAW OUTPUT" : "RESPONSE"}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: 2,
                    color: "var(--ak-signal)",
                  }}
                >
                  ◆ INTERCEPT
                </span>
              </div>
              <pre
                className="p-4 overflow-x-auto max-h-80 overflow-y-auto"
                style={{ fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5 }}
              >
                <code style={{ color: "var(--ak-signal)" }}>
                  {formatResult(result.result)}
                </code>
              </pre>
            </div>

            <button
              onClick={() => {
                setResult(null);
                setError("");
                setTask("");
              }}
              className="px-5 py-3 text-sm font-medium"
              style={{
                fontFamily: "var(--font-sans)",
                background: "transparent",
                color: "var(--ak-ink)",
                border: "1px solid var(--ak-ink)",
              }}
            >
              RUN AGAIN
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
