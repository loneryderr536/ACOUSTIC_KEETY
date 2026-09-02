"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSubscriber } from "@/lib/useSubscriber";
import { LEGACY_PLAN_MAP } from "@/lib/plans";

interface Tier {
  code: string;
  name: string;
  plan: string;
  price: string;
  period?: string;
  calls: string;
  agents: string;
  features: string[];
  cta: string;
  popular?: boolean;
}

const tiers: Tier[] = [
  {
    code: "RCT",
    name: "RECRUIT",
    plan: "recruit",
    price: "Free",
    calls: "100 credits/mo",
    agents: "Haiku-tier only",
    features: [
      "100 Haiku calls per month",
      "API only",
      "No premium agents",
      "Community support",
    ],
    cta: "Enlist Now",
  },
  {
    code: "FA",
    name: "FIELD AGENT",
    plan: "field_agent",
    price: "$19",
    period: "/mo",
    calls: "1,900 credits/mo",
    agents: "Every tier",
    features: [
      "1,900 Haiku · 633 Standard · 190 Premium calls",
      "API + Telegram",
      "Priority latency",
      "Webhooks & analytics",
    ],
    cta: "Begin Operations",
    popular: true,
  },
  {
    code: "00",
    name: "DOUBLE-0",
    plan: "double_0",
    price: "$79",
    period: "/mo",
    calls: "7,900 credits/mo",
    agents: "Every tier",
    features: [
      "7,900 Haiku · 2,633 Standard · 790 Premium calls",
      "API + Telegram",
      "Lowest latency",
      "Advanced analytics",
      "Early access",
    ],
    cta: "Request Clearance",
  },
  {
    code: "SH",
    name: "SHADOW",
    plan: "shadow",
    price: "$249",
    period: "/mo",
    calls: "24,900 credits/mo",
    agents: "Every tier + priority",
    features: [
      "24,900 Haiku · 8,300 Standard · 2,490 Premium calls",
      "All channels + priority routing",
      "Lowest latency",
      "Full analytics",
      "Priority support",
      "Enterprise features",
    ],
    cta: "Go Dark",
  },
];

const PLAN_ORDER = ["recruit", "field_agent", "double_0", "shadow"];

export function PricingCards() {
  const { apiKey, isSignedIn } = useSubscriber();
  const router = useRouter();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [currentPlan, setCurrentPlan] = useState<string | null>(null);

  // Fetch current plan if signed in
  useEffect(() => {
    if (!apiKey) return;
    fetch("/api/dashboard/stats", {
      headers: { Authorization: `Bearer ${apiKey}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (data?.plan) setCurrentPlan(data.plan); })
      .catch(() => {});
  }, [apiKey]);

  // Resolve a plan name (possibly legacy) to the canonical plan id
  function resolveCurrentPlan(plan: string): string {
    return LEGACY_PLAN_MAP[plan] ?? plan;
  }

  async function handleSelect(tier: Tier) {
    setError("");

    // Free tier → just sign up
    if (tier.plan === "recruit") {
      router.push(isSignedIn ? "/dashboard" : "/signup");
      return;
    }

    // Paid tiers → need auth first
    if (!isSignedIn || !apiKey) {
      router.push(`/signup?redirect=/pricing`);
      return;
    }

    const resolved = currentPlan ? resolveCurrentPlan(currentPlan) : null;

    // Already on this plan
    if (resolved === tier.plan) {
      setError("You are already on this plan.");
      return;
    }

    // Trying to downgrade to a lower paid tier
    if (resolved && PLAN_ORDER.indexOf(resolved) > PLAN_ORDER.indexOf(tier.plan)) {
      setError("To downgrade, use the Manage Plan button in your dashboard.");
      toast.warning('To change plans, use the billing portal.');
      return;
    }

    // Call checkout API
    setLoadingPlan(tier.plan);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ plan: tier.plan }),
      });
      const data = await res.json();

      if (res.status === 503) {
        // Stripe not configured — beta mode
        setError("Payments are not yet enabled. During beta, all plans are free. You already have access!");
        return;
      }

      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        toast.info('Redirecting to checkout...');
        window.location.href = data.url;
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoadingPlan(null);
    }
  }

  const resolvedCurrent = currentPlan ? resolveCurrentPlan(currentPlan) : null;

  return (
    <div className="space-y-4">
      {error && (
        <div
          className="border p-3 text-center"
          style={{
            borderColor: "var(--ak-stamp)",
            background: "rgba(178,58,42,0.05)",
          }}
        >
          <p
            className="text-xs"
            style={{
              color: "var(--ak-stamp)",
              fontFamily: "var(--font-mono)",
              letterSpacing: 1.2,
            }}
          >
            {error}
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border-l border-t" style={{ borderColor: "var(--ak-rule)" }}>
        {tiers.map((tier) => {
          const isCurrentPlan = resolvedCurrent === tier.plan;
          return (
            <div
              key={tier.name}
              className="relative flex flex-col p-7 border-r border-b"
              style={{
                borderColor: "var(--ak-rule)",
                background: tier.popular ? "var(--ak-paper-light)" : "transparent",
              }}
            >
              {tier.popular && (
                <div
                  className="absolute top-0 left-0 right-0"
                  style={{ height: 2, background: "var(--ak-signal)" }}
                />
              )}

              <div
                className="mb-4"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2.5,
                  color: "var(--ak-ink3)",
                }}
              >
                CLEARANCE / {tier.code}
              </div>

              <h3
                className="mb-3"
                style={{
                  fontFamily: "var(--font-heading)",
                  fontSize: 32,
                  lineHeight: 1,
                  letterSpacing: -0.8,
                  color: "var(--ak-ink)",
                }}
              >
                {tier.name}
              </h3>

              <div className="flex items-baseline gap-1">
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: 52,
                    lineHeight: 1,
                    letterSpacing: -2,
                    color: "var(--ak-ink)",
                  }}
                >
                  {tier.price}
                </span>
                {tier.period && (
                  <span
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 14,
                      color: "var(--ak-ink3)",
                    }}
                  >
                    {tier.period}
                  </span>
                )}
              </div>

              <p
                className="mt-3 pb-4 border-b"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1.3,
                  color: "var(--ak-ink3)",
                  borderColor: "var(--ak-rule-soft)",
                  textTransform: "uppercase",
                }}
              >
                {tier.calls} · {tier.agents}
              </p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span
                      className="mt-1 shrink-0"
                      style={{
                        color: "var(--ak-signal-deep)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                      }}
                    >
                      ▸
                    </span>
                    <span
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 14,
                        lineHeight: 1.45,
                        color: "var(--ak-ink2)",
                      }}
                    >
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelect(tier)}
                disabled={loadingPlan === tier.plan || isCurrentPlan}
                className="mt-6 w-full py-3 px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: 0.3,
                  border: "1px solid var(--ak-ink)",
                  background: isCurrentPlan
                    ? "transparent"
                    : tier.popular
                      ? "var(--ak-signal)"
                      : "var(--ak-ink)",
                  color: isCurrentPlan
                    ? "var(--ak-ink)"
                    : tier.popular
                      ? "var(--ak-ink)"
                      : "var(--ak-paper)",
                  textTransform: "uppercase",
                }}
              >
                {isCurrentPlan
                  ? "CURRENT PLAN"
                  : loadingPlan === tier.plan
                    ? "PROCESSING..."
                    : tier.cta}
              </button>

              <div
                className="text-center mt-4"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  letterSpacing: 2.5,
                  color: "var(--ak-ink3)",
                }}
              >
                {tier.code} PROTOCOL
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
