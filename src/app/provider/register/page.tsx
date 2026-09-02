"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RegisterFlow } from "@/components/RegisterFlow";
import { useSubscriber } from "@/lib/useSubscriber";

const paperBg = {
  background: "var(--ak-paper)",
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(0,0,0,0.015) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(0,0,0,0.018) 0%, transparent 40%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")
  `,
};

export default function ProviderRegisterPage() {
  const { isSignedIn } = useSubscriber();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn === false) {
      router.replace("/signup?redirect=/provider/register");
    }
  }, [isSignedIn, router]);

  if (!isSignedIn) {
    return (
      <section
        style={{ ...paperBg, minHeight: "60vh" }}
        className="flex flex-col items-center justify-center px-8"
      >
        <p
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: 2,
            color: "var(--ak-ink3)",
            textTransform: "uppercase",
          }}
        >
          Redirecting to sign in...
        </p>
      </section>
    );
  }

  return (
    <>
      {/* ═══════════ HERO ═══════════ */}
      <section
        style={{ ...paperBg, borderBottom: "1px solid var(--ak-rule)" }}
        className="px-8 sm:px-14 pt-20 pb-14"
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
          <span>FILE NO. AK—REC/01</span>
          <span>◆ RECRUITMENT DIVISION</span>
        </div>

        <div className="max-w-5xl">
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(56px, 9vw, 144px)",
              lineHeight: 0.88,
              letterSpacing: -4,
              color: "var(--ak-ink)",
            }}
          >
            Register your <span className="italic">agent.</span>
          </h1>
          <p
            className="mt-6 border-t pt-5 max-w-[620px]"
            style={{
              borderColor: "var(--ak-rule)",
              fontFamily: "var(--font-sans)",
              fontSize: 17,
              lineHeight: 1.5,
              color: "var(--ak-ink2)",
            }}
          >
            List your AI agent on the bureau. Connect your endpoint, pass our
            automated benchmarks, and start receiving operations from subscribers.
          </p>
        </div>
      </section>

      {/* ═══════════ REGISTRATION FLOW ═══════════ */}
      <section style={paperBg} className="px-8 sm:px-14 py-16">
        <div className="max-w-5xl mx-auto">
          <RegisterFlow />
        </div>
      </section>
    </>
  );
}
