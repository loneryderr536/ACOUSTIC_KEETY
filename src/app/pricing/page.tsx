import type { Metadata } from "next";
import { baseMetadata, faqJsonLd } from "@/lib/seo";
import { JsonLd } from "@/components/JsonLd";
import { PricingCards } from "@/components/PricingCards";

export function generateMetadata(): Metadata {
  return baseMetadata({
    title: "Clearance Levels — Pricing",
    description:
      "Transparent pricing for the Acoustic Kitty intelligence bureau. Free tier, usage-based billing, and enterprise access.",
  });
}

const faqs = [
  {
    question: "How do credits work?",
    answer:
      "Each plan includes a monthly credit allocation denominated 1 credit = $0.01. Your subscription dollars equal the dollar value of credits you receive — $19 buys 1,900 credits. Different agent tiers burn credits at different rates: Haiku agents cost 1 credit per call, Standard agents cost 3, and Premium agents cost 10. Credits expire at the end of each monthly billing cycle — unused credits do not roll over.",
  },
  {
    question: "Is there a free tier?",
    answer:
      "Yes. The Recruit clearance gives you 100 free credits per month — enough for 100 Haiku-tier agent calls. Free accounts can only access Haiku-tier agents; Standard and Premium agents require a paid plan. No credit card required to start.",
  },
  {
    question: "What if I run out of credits mid-month?",
    answer:
      "When your balance hits zero, further API calls return a 429 until your next billing cycle. You can upgrade your clearance level at any time — upgrades prorate immediately and restock your credits at the new tier's allocation.",
  },
  {
    question: "Can I switch clearance levels at any time?",
    answer:
      "Yes. Upgrades take effect immediately and you are billed pro-rata. Downgrades take effect at the end of your current billing cycle.",
  },
  {
    question: "Why does a Premium call cost more credits than a Haiku call?",
    answer:
      "Premium agents run on frontier models (Opus, Sonnet-class) with substantially higher compute costs per request. The credit multiplier — 10 credits per Premium call vs 1 credit per Haiku call — reflects the real underlying cost so providers running expensive models earn enough to cover their compute and still make a margin. Without it, no premium agent could profitably list here.",
  },
  {
    question: "How do provider payouts work?",
    answer:
      "Providers earn on every successful credit consumed against their agent. Payouts are processed monthly via Stripe Connect once you reach the $50 minimum. Earnings below the threshold roll forward to the next cycle — they're never lost. See the provider terms for the full fee schedule.",
  },
  {
    question: "What payment methods are accepted?",
    answer:
      "We accept all major credit and debit cards via Stripe. Enterprise customers can pay by invoice with NET-30 terms.",
  },
  {
    question: "Is my payment information secure?",
    answer:
      "Absolutely. All payment processing is handled by Stripe, a PCI Level 1 certified payment processor. We never store card details on our servers.",
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

export default function PricingPage() {
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
          <span>FILE NO. AK—2026/04 · PRICING</span>
          <span>◆ CHOOSE YOUR ACCESS</span>
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
            Clearance<br />
            <span className="italic">levels.</span>
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
            Start free. Scale as you grow. Only pay for what you use beyond your
            clearance level&apos;s included operations.
          </div>
        </div>
      </section>

      {/* ═══════════ /01 TIERS ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 py-20"
      >
        <div
          className="mb-10 flex items-baseline justify-between"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 2,
            color: "var(--ak-ink3)",
          }}
        >
          <span>/01 · TIERS</span>
          <span>CREDITS &nbsp;—&nbsp; 1 CREDIT = $0.01 · EXPIRES MONTHLY</span>
        </div>

        <PricingCards />

        {/* Credit burn-rate table */}
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-14 items-start">
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
              /BURN RATE
            </div>
            <h2
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 36,
                lineHeight: 1.05,
                letterSpacing: -0.8,
                color: "var(--ak-ink)",
              }}
            >
              Not all calls <span className="italic">burn the same.</span>
            </h2>
            <p
              className="mt-3 max-w-[380px]"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--ak-ink2)",
              }}
            >
              Heavier models cost more credits per call. Your subscription dollars always equal the credit dollars you receive — how you spend them is up to you.
            </p>
          </div>
          <div className="border" style={{ borderColor: "var(--ak-rule)" }}>
            <div className="grid grid-cols-4 border-b" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: 1.5, color: "var(--ak-ink3)" }}>
              <div className="p-4 border-r" style={{ borderColor: "var(--ak-rule)" }}>MODEL TIER</div>
              <div className="p-4 border-r" style={{ borderColor: "var(--ak-rule)" }}>CREDITS / CALL</div>
              <div className="p-4 border-r" style={{ borderColor: "var(--ak-rule)" }}>$ / CALL</div>
              <div className="p-4">EXAMPLE</div>
            </div>
            {[
              { tier: "HAIKU", credits: "1", dollar: "$0.01", example: "Tagline · classification · quick lookup" },
              { tier: "STANDARD", credits: "3", dollar: "$0.03", example: "Summarisation · code review · NLP" },
              { tier: "PREMIUM", credits: "10", dollar: "$0.10", example: "Contract analysis · multi-step research" },
            ].map((row, i, arr) => (
              <div
                key={row.tier}
                className={`grid grid-cols-4 ${i < arr.length - 1 ? "border-b" : ""}`}
                style={{ borderColor: "var(--ak-rule-soft)" }}
              >
                <div
                  className="p-4 border-r"
                  style={{
                    borderColor: "var(--ak-rule)",
                    fontFamily: "var(--font-heading)",
                    fontSize: 22,
                    letterSpacing: -0.4,
                    color: "var(--ak-ink)",
                  }}
                >
                  {row.tier}
                </div>
                <div
                  className="p-4 border-r"
                  style={{
                    borderColor: "var(--ak-rule)",
                    fontFamily: "var(--font-heading)",
                    fontSize: 20,
                    letterSpacing: -0.3,
                    color: "var(--ak-signal-deep)",
                  }}
                >
                  {row.credits}
                </div>
                <div
                  className="p-4 border-r"
                  style={{
                    borderColor: "var(--ak-rule)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    color: "var(--ak-ink2)",
                  }}
                >
                  {row.dollar}
                </div>
                <div
                  className="p-4"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    color: "var(--ak-ink2)",
                  }}
                >
                  {row.example}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ /02 BILLING SUMMARY ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 py-14"
      >
        <div className="grid grid-cols-1 sm:grid-cols-[280px_1fr] gap-14 items-center">
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
              /02 · BILLING SUMMARY
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 border p-6" style={{ borderColor: "var(--ak-rule)" }}>
            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                lineHeight: 1.55,
                color: "var(--ak-ink2)",
              }}
              className="max-w-[640px]"
            >
              Credits reset monthly at the start of each billing cycle. Paid plans unlock every agent tier; the free tier is Haiku-only. Providers are paid monthly via Stripe Connect. All payments processed by Stripe (PCI Level 1).
            </p>
            <a
              href="/reference#payments"
              className="shrink-0 hover:opacity-70 transition-opacity"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 2,
                color: "var(--ak-ink)",
              }}
            >
              BILLING DETAILS →
            </a>
          </div>
        </div>
      </section>

      {/* ═══════════ /03 FAQ ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 py-24"
      >
        <JsonLd data={faqJsonLd(faqs)} />
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
              /03 · INTELLIGENCE BRIEFING
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: 1.5,
                color: "var(--ak-ink2)",
                lineHeight: 1.8,
              }}
            >
              CLASSIFICATION &nbsp;—&nbsp; OPEN<br />
              REFERENCE &nbsp;—&nbsp; FAQ/01<br />
              PAGES &nbsp;—&nbsp; {String(faqs.length).padStart(2, "0")} / {String(faqs.length).padStart(2, "0")}
            </div>
          </div>
          <div>
            <div
              className="mb-10"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(40px, 5vw, 72px)",
                lineHeight: 0.95,
                letterSpacing: -2,
                color: "var(--ak-ink)",
              }}
            >
              Frequently <span className="italic">asked.</span>
            </div>
            <div className="border-t" style={{ borderColor: "var(--ak-rule)" }}>
              {faqs.map((faq) => (
                <details
                  key={faq.question}
                  className="group border-b"
                  style={{ borderColor: "var(--ak-rule)" }}
                >
                  <summary className="flex items-center justify-between py-5 cursor-pointer list-none">
                    <span
                      className="pr-4"
                      style={{
                        fontFamily: "var(--font-heading)",
                        fontSize: 22,
                        letterSpacing: -0.3,
                        color: "var(--ak-ink)",
                      }}
                    >
                      {faq.question}
                    </span>
                    <span
                      className="shrink-0"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 14,
                        color: "var(--ak-ink3)",
                      }}
                    >
                      <span className="group-open:hidden">+</span>
                      <span className="hidden group-open:inline">−</span>
                    </span>
                  </summary>
                  <p
                    className="pb-6 pr-8 max-w-[680px]"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 15,
                      lineHeight: 1.6,
                      color: "var(--ak-ink2)",
                    }}
                  >
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
