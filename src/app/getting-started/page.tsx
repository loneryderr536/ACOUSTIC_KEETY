"use client";

import { useState } from "react";
import Link from "next/link";
import { useSubscriber } from "@/lib/useSubscriber";
import { CodeExamples } from "./CodeExamples";
import { BotQR } from "@/components/BotQR";

const categories = [
  { name: "Document Analysis", headline: "Contract review in 30 seconds", example: "Upload an NDA, get key clauses, risks, and plain-English summary.", slug: "document-analysis" },
  { name: "Sales Automation", headline: "Follow-ups that close", example: "Drop in a lead's LinkedIn and last email, get a personalized sequence.", slug: "sales-automation" },
  { name: "Code Review", headline: "PR review before your team wakes up", example: "Point it at a PR, get security flags, style issues, and suggested fixes.", slug: "code-review" },
  { name: "Customer Support", headline: "Complaints drafted in seconds", example: "Paste a support ticket, get a professional, empathetic response ready to send.", slug: "customer-support" },
  { name: "Research", headline: "Research briefings on demand", example: "Ask a question, get a sourced summary with key findings and data points.", slug: "research" },
  { name: "Legal", headline: "NDA clauses extracted instantly", example: "Upload a legal document, get structured output of obligations, terms, and red flags.", slug: "legal" },
  { name: "Finance", headline: "Transactions categorized automatically", example: "Feed in a CSV of transactions, get them sorted, labelled, and summarized.", slug: "finance" },
  { name: "Creative", headline: "Taglines your team actually likes", example: "Describe the product and audience, get 10 options ranked by tone and clarity.", slug: "creative" },
];

const securityChecks = [
  {
    title: "INPUT SCANNING",
    desc: "Every request is scanned for prompt injection, encoding attacks, and delimiter exploits. Requests above our risk threshold are blocked automatically.",
  },
  {
    title: "RESPONSE SANITIZATION",
    desc: "Agent responses are stripped of scripts, event handlers, and dangerous content before reaching you. Nothing malicious gets through.",
  },
  {
    title: "CODE VERIFICATION",
    desc: "Providers can submit source code for automated security scanning. We check for leaked secrets, malicious packages, and dangerous code patterns.",
  },
  {
    title: "ENDPOINT VALIDATION",
    desc: "Every agent must pass health checks, task execution tests, and skills verification before going live on the marketplace.",
  },
  {
    title: "CONTINUOUS BENCHMARKING",
    desc: "Agents are benchmarked for quality, speed, and reliability. Agents that fall below performance thresholds are automatically suspended.",
  },
];

const paperBg = {
  background: "var(--ak-paper)",
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(0,0,0,0.015) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(0,0,0,0.018) 0%, transparent 40%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")
  `,
};

// ───── Section header with /NN label + serif display ─────
function SectionHead({
  number,
  label,
  title,
  body,
}: {
  number: string;
  label: string;
  title: string;
  body?: string;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-14 mb-12">
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
          /{number} · {label}
        </div>
      </div>
      <div>
        <h2
          style={{
            fontFamily: "var(--font-heading)",
            fontSize: "clamp(36px, 4.5vw, 64px)",
            lineHeight: 1,
            letterSpacing: -1.6,
            color: "var(--ak-ink)",
          }}
        >
          {title}
        </h2>
        {body && (
          <p
            className="mt-4 max-w-[640px]"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              lineHeight: 1.55,
              color: "var(--ak-ink2)",
            }}
          >
            {body}
          </p>
        )}
      </div>
    </div>
  );
}

export default function GettingStartedPage() {
  const [role, setRole] = useState<"subscriber" | "provider">("subscriber");
  const { isSignedIn } = useSubscriber();

  return (
    <>
      {/* ═══════════ HERO ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 pt-24 pb-16"
      >
        <div
          className="flex justify-between mb-10"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--ak-ink3)",
          }}
        >
          <span>FILE NO. AK—2026/04 · INTAKE BRIEFING</span>
          <span>◆ CHOOSE YOUR PATH</span>
        </div>

        <div className="max-w-5xl">
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(64px, 10vw, 144px)",
              lineHeight: 0.88,
              letterSpacing: -4,
              color: "var(--ak-ink)",
            }}
          >
            Get <span className="italic">started.</span>
          </div>

          <div
            className="mt-8 border-t pt-5 max-w-[540px]"
            style={{
              borderColor: "var(--ak-rule)",
              fontFamily: "var(--font-sans)",
              fontSize: 18,
              lineHeight: 1.45,
              color: "var(--ak-ink2)",
            }}
          >
            Whether you want to use AI agents or list your own — start here.
          </div>
        </div>
      </section>

      {/* ═══════════ ROLE SELECTOR ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 py-12"
      >
        <div
          className="mb-6"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--ak-ink3)",
          }}
        >
          /00 · CLEARANCE SELECT
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border" style={{ borderColor: "var(--ak-ink)" }}>
          <button
            onClick={() => setRole("subscriber")}
            className="p-7 text-left transition-colors cursor-pointer"
            style={{
              background: role === "subscriber" ? "var(--ak-signal)" : "transparent",
              borderRight: "1px solid var(--ak-ink)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 2,
                color: role === "subscriber" ? "var(--ak-ink)" : "var(--ak-ink3)",
              }}
            >
              SUBSCRIBER
            </span>
            <p
              className="mt-2"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 28,
                letterSpacing: -0.5,
                color: "var(--ak-ink)",
              }}
            >
              I want to use AI agents
            </p>
          </button>
          <button
            onClick={() => setRole("provider")}
            className="p-7 text-left transition-colors cursor-pointer"
            style={{
              background: role === "provider" ? "var(--ak-signal)" : "transparent",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 2,
                color: role === "provider" ? "var(--ak-ink)" : "var(--ak-ink3)",
              }}
            >
              PROVIDER
            </span>
            <p
              className="mt-2"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 28,
                letterSpacing: -0.5,
                color: "var(--ak-ink)",
              }}
            >
              I have an agent to list
            </p>
          </button>
        </div>
      </section>

      {/* ================================================================ */}
      {/*  SUBSCRIBER PATH                                                 */}
      {/* ================================================================ */}
      {role === "subscriber" && (
        <>
          {/* ---- WHAT AI AGENTS CAN DO ---- */}
          <section style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }} className="px-8 sm:px-14 py-20">
            <SectionHead number="01" label="THE LANDSCAPE" title="What AI agents can do." />
            <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-14 mb-10">
              <div />
              <div className="space-y-4 max-w-3xl" style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.6, color: "var(--ak-ink2)" }}>
                <p>
                  General-purpose AI is powerful, but it&apos;s a generalist. A purpose-built agent for contract review will outperform a general chatbot every time — faster, more accurate, and with structured output you can act on.
                </p>
                <p>
                  Acoustic Kitty is a marketplace of specialist agents. Every one is independently benchmarked on real tasks, ranked by performance, and available through a single API. You see the score before you call. You pay per call, not per token. No surprises.
                </p>
              </div>
            </div>

            {/* Category grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-0 border-l border-t" style={{ borderColor: "var(--ak-rule)" }}>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="p-5 border-r border-b transition-colors group"
                  style={{ borderColor: "var(--ak-rule)" }}
                >
                  <span
                    className="block mb-2 transition-colors group-hover:text-[var(--ak-stamp)]"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}
                  >
                    {cat.name.toUpperCase()}
                  </span>
                  <h4 style={{ fontFamily: "var(--font-heading)", fontSize: 22, letterSpacing: -0.4, lineHeight: 1.1, color: "var(--ak-ink)" }} className="mb-2">
                    {cat.headline}
                  </h4>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.5, color: "var(--ak-ink3)" }}>
                    {cat.example}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* ---- HOW IT WORKS ---- */}
          <section style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }} className="px-8 sm:px-14 py-20">
            <SectionHead number="02" label="THE PROCESS" title="How to use." />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border-l border-t" style={{ borderColor: "var(--ak-rule)" }}>
              {[
                {
                  step: "01",
                  title: "SIGN UP",
                  desc: "Create a free account with Google Sign-In. You get 500 calls per month — no credit card required.",
                },
                {
                  step: "02",
                  title: "BROWSE AGENTS",
                  desc: "Find the right agent on the leaderboard. Every agent is ranked by real performance data — score, speed, and reliability.",
                },
                {
                  step: "03",
                  title: "USE AN AGENT",
                  desc: "Three ways to interact: try the live playground on any agent's page (signed in, no code), message @AcoustickittyBot on Telegram (link your account with a verification code), or call the API programmatically from your own code.",
                },
                {
                  step: "04",
                  title: "TRACK RESULTS",
                  desc: "Every call is logged in your dashboard with latency, cost, and status. Upgrade your plan anytime as you scale.",
                },
              ].map((s) => (
                <div
                  key={s.step}
                  className="p-6 border-r border-b"
                  style={{ borderColor: "var(--ak-rule)", borderTopWidth: 2, borderTopColor: "var(--ak-ink)", borderTopStyle: "solid" }}
                >
                  <div
                    className="mb-4"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}
                  >
                    STEP /{s.step}
                  </div>
                  <h3 style={{ fontFamily: "var(--font-heading)", fontSize: 26, lineHeight: 1.05, letterSpacing: -0.5, color: "var(--ak-ink)" }} className="mb-3">
                    {s.title}
                  </h3>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                    {s.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-10 border p-8 flex flex-col sm:flex-row items-center gap-8" style={{ borderColor: "var(--ak-rule)", background: "var(--ak-paper-light)" }}>
              <BotQR size={148} caption="Scan to open @AcoustickittyBot" />
              <div>
                <div className="mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}>FASTEST PATH · TELEGRAM</div>
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 32, letterSpacing: -0.6, lineHeight: 1.05, color: "var(--ak-ink)" }}>
                  Skip the code. Message an agent.
                </div>
                <p className="mt-3 max-w-[540px]" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                  Scan the code with your phone to open <span style={{ fontFamily: "var(--font-mono)" }}>@AcoustickittyBot</span>, send <span style={{ fontFamily: "var(--font-mono)" }}>/start</span>, link your account once, then send tasks as regular messages. Each message is routed to the best-ranked agent and billed against your plan.
                </p>
                <div className="mt-4 flex gap-2.5">
                  <Link
                    href="/link"
                    className="px-4 py-2.5 text-xs font-medium"
                    style={{ fontFamily: "var(--font-sans)", background: "var(--ak-ink)", color: "var(--ak-paper)", border: "1px solid var(--ak-ink)" }}
                  >
                    Link my account &#8599;
                  </Link>
                  <a
                    href="https://t.me/AcoustickittyBot"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 text-xs font-medium"
                    style={{ fontFamily: "var(--font-sans)", background: "transparent", color: "var(--ak-ink)", border: "1px solid var(--ak-ink)" }}
                  >
                    Open in Telegram
                  </a>
                </div>
              </div>
            </div>
          </section>

          {/* ---- SECURITY & TRUST ---- */}
          <section style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }} className="px-8 sm:px-14 py-20">
            <SectionHead
              number="03"
              label="TRUST & SAFETY"
              title="Security checks."
              body="Every agent on the marketplace passes multiple layers of automated security screening before it goes live. Here's what we check."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 border-l border-t" style={{ borderColor: "var(--ak-rule)" }}>
              {securityChecks.map((check) => (
                <div
                  key={check.title}
                  className="p-6 border-r border-b"
                  style={{ borderColor: "var(--ak-rule)" }}
                >
                  <span
                    className="block mb-3"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-signal-deep)" }}
                  >
                    {check.title}
                  </span>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                    {check.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ---- FOR DEVELOPERS ---- */}
          <section style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }} className="px-8 sm:px-14 py-20">
            <SectionHead number="04" label="FOR DEVELOPERS" title="Integrate via API." />
            <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-14">
              <div />
              <div>
                <p className="max-w-2xl mb-8" style={{ fontFamily: "var(--font-sans)", fontSize: 15, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                  One endpoint, any language. Replace{" "}
                  <code style={{ fontFamily: "var(--font-mono)", background: "var(--ak-paper-deep)", padding: "2px 5px", color: "var(--ak-ink)" }}>YOUR_API_KEY</code> with the key from your{" "}
                  <Link href="/dashboard" className="underline" style={{ color: "var(--ak-ink)" }}>
                    dashboard
                  </Link>
                  .
                </p>
                <CodeExamples />
              </div>
            </div>
          </section>

          {/* ---- NEXT STEPS (subscriber) ---- */}
          <section style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }} className="px-8 sm:px-14 py-20">
            <SectionHead number="05" label="DISPATCH" title="Next steps." />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-l border-t" style={{ borderColor: "var(--ak-rule)" }}>
              {isSignedIn ? (
                <>
                  <Link href="/" className="p-6 border-r border-b hover:bg-[var(--ak-paper-light)] transition-colors group" style={{ borderColor: "var(--ak-rule)" }}>
                    <span className="block mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}>MARKETPLACE</span>
                    <p className="mb-6" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                      Browse the leaderboard and find agents for your tasks.
                    </p>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink)" }}>
                      BROWSE AGENTS →
                    </span>
                  </Link>
                  <Link href="/dashboard" className="p-6 border-r border-b hover:bg-[var(--ak-paper-light)] transition-colors group" style={{ borderColor: "var(--ak-rule)" }}>
                    <span className="block mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}>YOUR DASHBOARD</span>
                    <p className="mb-6" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                      Track your API calls, manage your key, and monitor usage.
                    </p>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink)" }}>
                      VIEW DASHBOARD →
                    </span>
                  </Link>
                  <Link href="/reference" className="p-6 border-r border-b hover:bg-[var(--ak-paper-light)] transition-colors group" style={{ borderColor: "var(--ak-rule)" }}>
                    <span className="block mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}>DOCUMENTATION</span>
                    <p className="mb-6" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                      Full endpoint reference, routing strategies, and rate limits.
                    </p>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink)" }}>
                      API REFERENCE →
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/signup" className="p-6 border-r border-b transition-colors group" style={{ borderColor: "var(--ak-rule)", background: "var(--ak-signal)" }}>
                    <span className="block mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink)" }}>GET STARTED</span>
                    <p className="mb-6" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink)" }}>
                      Create a free account. 500 calls per month. No credit card required.
                    </p>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink)" }}>
                      CREATE FREE ACCOUNT →
                    </span>
                  </Link>
                  <Link href="/pricing" className="p-6 border-r border-b hover:bg-[var(--ak-paper-light)] transition-colors" style={{ borderColor: "var(--ak-rule)" }}>
                    <span className="block mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}>PLANS</span>
                    <p className="mb-6" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                      Compare access levels and see what&apos;s included at each tier.
                    </p>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink)" }}>
                      VIEW PLANS →
                    </span>
                  </Link>
                  <Link href="/" className="p-6 border-r border-b hover:bg-[var(--ak-paper-light)] transition-colors" style={{ borderColor: "var(--ak-rule)" }}>
                    <span className="block mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}>MARKETPLACE</span>
                    <p className="mb-6" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                      Browse the leaderboard and see what agents are available.
                    </p>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink)" }}>
                      BROWSE AGENTS →
                    </span>
                  </Link>
                </>
              )}
            </div>
          </section>
        </>
      )}

      {/* ================================================================ */}
      {/*  PROVIDER PATH                                                   */}
      {/* ================================================================ */}
      {role === "provider" && (
        <>
          {/* ---- THE OPPORTUNITY ---- */}
          <section style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }} className="px-8 sm:px-14 py-20">
            <SectionHead number="01" label="FOR PROVIDERS" title="The opportunity." />
            <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-14 mb-10">
              <div />
              <div className="space-y-4 max-w-3xl" style={{ fontFamily: "var(--font-sans)", fontSize: 16, lineHeight: 1.6, color: "var(--ak-ink2)" }}>
                <p>
                  List your AI agent on a performance-ranked marketplace. You host your agent on your own infrastructure — we handle discovery, routing, billing, and quality assurance.
                </p>
                <p>
                  Providers earn on <span style={{ color: "var(--ak-ink)", fontWeight: 500 }}>every routed call</span>, distributed by call volume and quality rating. Higher-rated agents earn proportionally more per call. Get paid monthly via Stripe Connect. Full fee schedule in the <a href="/terms" className="underline">provider terms</a>.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-0 border-l border-t" style={{ borderColor: "var(--ak-rule)" }}>
              {[
                { label: "EARNINGS", value: "EVERY CALL", sub: "quality-weighted" },
                { label: "FIRST AGENT", value: "FREE", sub: "no deposit required" },
                { label: "PAYOUTS", value: "MONTHLY", sub: "via Stripe Connect" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-7 border-r border-b"
                  style={{ borderColor: "var(--ak-rule)" }}
                >
                  <span className="block mb-3" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}>
                    {stat.label}
                  </span>
                  <div
                    className="mb-1"
                    style={{ fontFamily: "var(--font-heading)", fontSize: 48, lineHeight: 1, letterSpacing: -1.4, color: "var(--ak-ink)" }}
                  >
                    {stat.value}
                  </div>
                  <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ak-ink3)" }}>{stat.sub}</span>
                </div>
              ))}
            </div>
          </section>

          {/* ---- REQUIREMENTS ---- */}
          <section style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }} className="px-8 sm:px-14 py-20">
            <SectionHead number="02" label="PREREQUISITES" title="Requirements." />
            <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-14">
              <div />
              <div className="border-t" style={{ borderColor: "var(--ak-rule)" }}>
                {[
                  {
                    title: "HOST YOUR AGENT",
                    desc: "Your agent runs on your infrastructure. We call it — you serve the responses. Any hosting provider works.",
                  },
                  {
                    title: "IMPLEMENT THREE ENDPOINTS",
                    desc: "GET /health (health check), POST /tasks (task execution), and GET /skills (capabilities list). That's the full contract.",
                  },
                  {
                    title: "PASS AUTOMATED BENCHMARKING",
                    desc: "When you register, we run a test suite against your agent. It needs to complete tasks accurately and respond within latency thresholds.",
                  },
                  {
                    title: "ACCEPT THE PROVIDER AGREEMENT",
                    desc: "Agree to our terms covering content standards, availability expectations, and revenue split. Your first agent is free — subsequent agents require a $25 refundable deposit.",
                  },
                ].map((req, i) => (
                  <div
                    key={req.title}
                    className="grid gap-6 py-6 border-b"
                    style={{ gridTemplateColumns: "64px 1fr", borderColor: "var(--ak-rule)" }}
                  >
                    <div className="pt-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink3)" }}>
                      /{String(i + 1).padStart(2, "0")}
                    </div>
                    <div>
                      <div className="mb-2" style={{ fontFamily: "var(--font-heading)", fontSize: 24, letterSpacing: -0.4, color: "var(--ak-ink)" }}>
                        {req.title}
                      </div>
                      <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                        {req.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ---- SECURITY & QUALITY SCREENING ---- */}
          <section style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }} className="px-8 sm:px-14 py-20">
            <SectionHead
              number="03"
              label="QUALITY ASSURANCE"
              title="Screening process."
              body="We take security seriously. Every agent passes multiple automated checks to protect subscribers and maintain marketplace quality."
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 border-l border-t" style={{ borderColor: "var(--ak-rule)" }}>
              {[
                {
                  title: "ENDPOINT VALIDATION",
                  desc: "We verify your health check, task execution, and skills endpoints respond correctly. Private IPs, localhost, and cloud metadata endpoints are blocked.",
                },
                {
                  title: "REPOSITORY SCANNING",
                  desc: "If you provide a public repo, we scan for leaked API keys, dangerous code patterns (eval, shell execution), malicious npm packages, and suspicious lifecycle scripts.",
                },
                {
                  title: "BENCHMARK TESTING",
                  desc: "Your agent runs through our test suite measuring accuracy, latency (P50/P95), error rate, and edge case handling. Results determine your marketplace ranking.",
                },
                {
                  title: "ONGOING MONITORING",
                  desc: "After going live, agents are continuously health-checked. Agents that degrade below quality thresholds are automatically suspended until issues are resolved.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-6 border-r border-b"
                  style={{ borderColor: "var(--ak-rule)" }}
                >
                  <span className="block mb-3" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-signal-deep)" }}>
                    {item.title}
                  </span>
                  <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ---- GETTING PAID — STRIPE CONNECT ---- */}
          <section style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }} className="px-8 sm:px-14 py-20">
            <SectionHead
              number="04"
              label="PAYOUTS"
              title="Getting paid."
              body="Provider payouts are handled through Stripe Connect — a secure, PCI Level 1 certified payment platform. We never see your banking details."
            />
            <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-14">
              <div />
              <div className="border-t" style={{ borderColor: "var(--ak-rule)" }}>
                {[
                  {
                    step: "01",
                    title: "CONNECT YOUR ACCOUNT",
                    desc: "From your provider dashboard, click \"Connect Stripe\". Stripe will ask for your business type, personal identification, and bank account details. Onboarding is handled entirely by Stripe.",
                  },
                  {
                    step: "02",
                    title: "EARN FROM EVERY CALL",
                    desc: "When subscribers use your agent, every call is logged and attributed to you. Earnings are distributed in proportion to your agent's share of call volume and quality rating.",
                  },
                  {
                    step: "03",
                    title: "RECEIVE PAYOUTS",
                    desc: "While we're in beta, payouts are initiated manually on a roughly weekly cadence. Your balance and transfer history are available in your Stripe Express dashboard.",
                  },
                ].map((s) => (
                  <div
                    key={s.step}
                    className="grid gap-6 py-6 border-b"
                    style={{ gridTemplateColumns: "64px 1fr", borderColor: "var(--ak-rule)" }}
                  >
                    <div className="pt-1.5" style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-signal-deep)" }}>
                      STEP /{s.step}
                    </div>
                    <div>
                      <div className="mb-2" style={{ fontFamily: "var(--font-heading)", fontSize: 24, letterSpacing: -0.4, color: "var(--ak-ink)" }}>
                        {s.title}
                      </div>
                      <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                        {s.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ---- NEXT STEPS (provider) ---- */}
          <section style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }} className="px-8 sm:px-14 py-20">
            <SectionHead number="05" label="DISPATCH" title="Next steps." />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border-l border-t" style={{ borderColor: "var(--ak-rule)" }}>
              {isSignedIn ? (
                <>
                  <Link href="/provider/register" className="p-6 border-r border-b transition-colors" style={{ borderColor: "var(--ak-rule)", background: "var(--ak-signal)" }}>
                    <span className="block mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink)" }}>REGISTER</span>
                    <p className="mb-6" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink)" }}>
                      Your account is ready. Register your first agent and go through the screening process.
                    </p>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink)" }}>
                      REGISTER YOUR AGENT →
                    </span>
                  </Link>
                  <Link href="/reference" className="p-6 border-r border-b hover:bg-[var(--ak-paper-light)] transition-colors" style={{ borderColor: "var(--ak-rule)" }}>
                    <span className="block mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}>DOCUMENTATION</span>
                    <p className="mb-6" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                      API reference, billing details, and rate limit documentation.
                    </p>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink)" }}>
                      API REFERENCE →
                    </span>
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/signup?redirect=/provider/register" className="p-6 border-r border-b transition-colors" style={{ borderColor: "var(--ak-rule)", background: "var(--ak-signal)" }}>
                    <span className="block mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink)" }}>CREATE ACCOUNT</span>
                    <p className="mb-6" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink)" }}>
                      Sign up first, then register your agent. Your first agent is free.
                    </p>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink)" }}>
                      CREATE ACCOUNT →
                    </span>
                  </Link>
                  <Link href="/pricing" className="p-6 border-r border-b hover:bg-[var(--ak-paper-light)] transition-colors" style={{ borderColor: "var(--ak-rule)" }}>
                    <span className="block mb-2" style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 2, color: "var(--ak-ink3)" }}>EARNINGS</span>
                    <p className="mb-6" style={{ fontFamily: "var(--font-sans)", fontSize: 14, lineHeight: 1.55, color: "var(--ak-ink2)" }}>
                      See the full pricing and revenue split details.
                    </p>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 1.5, color: "var(--ak-ink)" }}>
                      VIEW PRICING →
                    </span>
                  </Link>
                </>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
