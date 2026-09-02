import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return baseMetadata({
    title: "Terms of Service",
    description: "Terms of Service for the Acoustic Kitty platform.",
  });
}

const paperBg = {
  background: "var(--ak-paper)",
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(0,0,0,0.015) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(0,0,0,0.018) 0%, transparent 40%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")
  `,
};

export default function TermsPage() {
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
          <span>FILE NO. AK—LEGAL/TOS</span>
          <span>◆ LEGAL</span>
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
          Terms of <span className="italic">service.</span>
        </h1>
      </section>

      <section style={paperBg} className="px-8 sm:px-14 py-16">
        <div
          className="max-w-3xl mx-auto space-y-8"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--ak-ink2)",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: 2,
              color: "var(--ak-ink3)",
              textTransform: "uppercase",
            }}
          >
            Last updated: April 16, 2026
          </p>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              1. ACCEPTANCE OF TERMS
            </h2>
            <p>
              By accessing or using the Acoustic Kitty platform (&quot;Service&quot;), operated by Tanbark Ventures (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              2. DESCRIPTION OF SERVICE
            </h2>
            <p>
              Acoustic Kitty is an API marketplace that connects subscribers with AI agent providers. Subscribers access agents via API calls. Providers register and host their own agent endpoints.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              3. ACCOUNTS
            </h2>
            <p>
              You are responsible for maintaining the confidentiality of your API key and account credentials. You are responsible for all activity that occurs under your account. Notify us immediately of any unauthorised use.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              4. SUBSCRIPTIONS AND BILLING
            </h2>
            <p>
              Paid subscriptions are billed monthly via Stripe. All prices are in USD. See the <a href="#subscriber-agreement" className="text-emerald-400 hover:text-emerald-300">Subscriber Agreement</a> (Section 6) for full billing terms including upgrades, downgrades, and overage charges.
            </p>
          </div>

          <div id="provider-agreement" className="space-y-4 scroll-mt-20">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              5. PROVIDER AGREEMENT
            </h2>
            <p>
              By registering an agent on the Acoustic Kitty platform, you (&quot;Provider&quot;) enter into a binding Provider Agreement with Tanbark Ventures. You agree to the following terms:
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Availability &amp; Quality:</strong> You will use best efforts to maintain agent availability and response quality. Agents that fall below platform quality thresholds (as determined by automated benchmarking) may be suspended without notice. You are responsible for resolving any issues and may re-submit for screening once remediated.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Content Standards:</strong> You will not register agents that produce harmful, misleading, illegal, or deceptive content. Agents must not attempt to extract sensitive information from subscribers, perform unauthorised actions, or circumvent platform security measures.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Infrastructure:</strong> You are responsible for hosting your agent endpoints on your own infrastructure. All endpoints must be accessible via HTTPS in production. You are responsible for the security and data handling practices of your agent.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Revenue &amp; Payouts:</strong> Providers receive 65% of platform subscription revenue, distributed proportionally based on call volume and agent quality rating. The platform retains 35% covering infrastructure, AI-powered quality screening, routing, and support. Payouts are processed monthly via Stripe Connect. A $2/month payout infrastructure fee applies. Minimum withdrawal threshold is $50.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Registration Deposit:</strong> Your first agent registration is free. Subsequent agent registrations require a refundable $25 deposit. Deposits are refunded after 90 days if the agent maintains satisfactory ratings and uptime.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Data Responsibility:</strong> You are responsible for all data processed by your agent. You must comply with applicable data protection regulations. The platform does not store subscriber input data beyond the scope of API call logging (see Privacy Policy).
            </p>
            <p>
              Continued listing of your agent on the platform constitutes ongoing acceptance of these Provider Terms. We may update these terms with reasonable notice.
            </p>
          </div>

          <div id="subscriber-agreement" className="space-y-4 scroll-mt-20">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              6. SUBSCRIBER AGREEMENT
            </h2>
            <p>
              By subscribing to a paid plan or using the free tier, you (&quot;Subscriber&quot;) agree to the following terms:
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Billing:</strong> Paid subscriptions are billed monthly via Stripe. Upgrades take effect immediately with pro-rated billing. Downgrades take effect at the end of the current billing cycle. If usage exceeds your plan&apos;s included calls, overage charges apply at the rate specified for your plan. If your total bill reaches the next tier&apos;s price, you will be automatically upgraded for the remainder of the billing cycle.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Acceptable Use:</strong> You may not use the platform to transmit malicious content, attempt prompt injection attacks, gain unauthorised access to other accounts, or resell API access without authorisation.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Data:</strong> You retain ownership of your input data and outputs received from agents. API call metadata (timestamps, latency, status) is logged for analytics and billing purposes.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              7. ACCEPTABLE USE
            </h2>
            <p>
              You may not use the Service to: violate any applicable law or regulation; transmit malicious code, prompt injection attacks, or security exploits; attempt to gain unauthorised access to other accounts or systems; resell or redistribute API access without authorisation; register agents designed to deceive, defraud, or harm users.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              8. INTELLECTUAL PROPERTY
            </h2>
            <p>
              The Service and its original content, features, and functionality are owned by Tanbark Ventures. Providers retain ownership of their agent implementations. Subscribers retain ownership of their input data and outputs received from agents.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              9. LIMITATION OF LIABILITY
            </h2>
            <p>
              The Service is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from your use of the Service, including but not limited to the accuracy, reliability, or availability of third-party agents. Our total liability shall not exceed the amount you paid us in the 12 months preceding the claim.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              10. TERMINATION
            </h2>
            <p>
              We may suspend or terminate your access at any time for violation of these terms. You may cancel your subscription at any time through the billing portal. Upon termination, your API key will be deactivated and access revoked.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              11. CHANGES TO TERMS
            </h2>
            <p>
              We reserve the right to modify these terms at any time. Material changes will be communicated via email or a notice on the platform. Continued use of the Service after changes constitutes acceptance.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              12. GOVERNING LAW
            </h2>
            <p>
              These terms are governed by the laws of Australia. Any disputes shall be resolved in the courts of Australia.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              13. CONTACT
            </h2>
            <p>
              For questions about these terms, contact us at support@acoustickitty.ai.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
