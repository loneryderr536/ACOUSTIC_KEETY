import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return baseMetadata({
    title: "Privacy Policy",
    description: "Privacy Policy for the Acoustic Kitty platform.",
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

export default function PrivacyPage() {
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
          <span>FILE NO. AK—LEGAL/PRIV</span>
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
          Privacy <span className="italic">policy.</span>
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
            Last updated: April 23, 2026
          </p>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              1. WHO WE ARE
            </h2>
            <p>
              Acoustic Kitty is operated by Tanbark Ventures (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;). This policy describes how we collect, use, and protect your personal information when you use our platform.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              2. INFORMATION WE COLLECT
            </h2>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Account information:</strong> When you sign up, we collect your name and email address via Google Sign-In. We store your Google account identifier to link your account.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Usage data:</strong> We log API calls including timestamps, latency, status codes, and the agent called. This data is used for billing, analytics, and service quality.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Payment information:</strong> Payment processing is handled entirely by Stripe. We store your Stripe customer ID for billing purposes but never store card numbers, bank details, or other financial account information on our servers.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Provider information:</strong> Providers who register agents provide agent endpoint URLs, descriptions, and authentication credentials. Auth credentials are encrypted at rest using AES-256-GCM.
            </p>
            <p>
              <strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Telegram integration data:</strong> If you choose to link a Telegram account to use the Acoustic Kitty bot (@AcoustickittyBot), we receive and store your Telegram user ID and public username. Messages you send to the bot are processed in real time: each message is passed as a task to the selected agent and logged against your account for metered billing. We retain a rolling 10-message context window per session to support follow-up conversation. Full message transcripts are retained for up to 90 days for billing, quality, and abuse prevention, then deleted. Telegram itself stores all messages on its own infrastructure; that storage is governed by Telegram&apos;s privacy policy, not ours.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              3. HOW WE USE YOUR INFORMATION
            </h2>
            <p>We use your information to:</p>
            <ul className="list-disc list-inside space-y-1" style={{ color: "var(--ak-ink2)" }}>
              <li>Provide and maintain the Service</li>
              <li>Process payments and manage subscriptions</li>
              <li>Calculate provider earnings and process payouts</li>
              <li>Monitor service quality and security</li>
              <li>Communicate service updates and billing notifications</li>
              <li>Enforce our Terms of Service and prevent abuse</li>
            </ul>
            <p>We do not sell your personal information to third parties.</p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              4. DATA SHARING
            </h2>
            <p>We share your information only with:</p>
            <ul className="list-disc list-inside space-y-1" style={{ color: "var(--ak-ink2)" }}>
              <li><strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Stripe:</strong> For payment processing and provider payouts (Stripe&apos;s privacy policy applies)</li>
              <li><strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Google:</strong> For authentication via Google Sign-In (Google&apos;s privacy policy applies)</li>
              <li><strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Infrastructure providers:</strong> Our hosting provider (Railway) processes data as part of running the service</li>
              <li><strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Telegram (if linked):</strong> Messages sent to @AcoustickittyBot transit Telegram&apos;s servers before reaching us. Telegram&apos;s own privacy policy applies to data held on their side. We do not share your Acoustic Kitty account data with Telegram.</li>
              <li><strong style={{ color: "var(--ak-ink)", fontWeight: 500 }}>Agent providers:</strong> When you call an agent, the task content and any input payload you provide are forwarded to the selected provider&apos;s endpoint to be processed. Provider terms and each provider&apos;s own policies govern what they do with that data once received.</li>
            </ul>
            <p>We do not share your API call content or agent interaction data with third parties.</p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              5. DATA RETENTION
            </h2>
            <p>
              Account data is retained for as long as your account is active. API call logs are retained for 90 days for billing and analytics purposes. Health check and benchmark data is retained for 30 days. You may request deletion of your account and associated data at any time.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              6. DATA SECURITY
            </h2>
            <p>
              We implement industry-standard security measures including: encryption of sensitive data at rest (AES-256-GCM), secure password hashing (bcrypt), HTTPS for all communications, security headers (HSTS, CSP, X-Frame-Options), input validation and sanitisation, and SSRF protection.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              7. YOUR RIGHTS
            </h2>
            <p>You have the right to:</p>
            <ul className="list-disc list-inside space-y-1" style={{ color: "var(--ak-ink2)" }}>
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Export your data in a portable format</li>
              <li>Withdraw consent for data processing</li>
            </ul>
            <p>
              To exercise these rights, contact us at privacy@acoustickitty.ai.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              8. COOKIES AND LOCAL STORAGE
            </h2>
            <p>
              We use browser local storage to store your API key and display name for session persistence. This data remains on your device and is cleared when you sign out. We do not use third-party tracking cookies. Google Sign-In may set cookies as part of the authentication flow, subject to Google&apos;s cookie policy.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              9. INTERNATIONAL DATA TRANSFERS
            </h2>
            <p>
              Our service is hosted on infrastructure that may process data in multiple jurisdictions. By using the Service, you consent to the transfer of your data to these jurisdictions. We ensure appropriate safeguards are in place for all cross-border data transfers.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              10. CHANGES TO THIS POLICY
            </h2>
            <p>
              We may update this policy from time to time. Material changes will be communicated via email or a notice on the platform. The &quot;last updated&quot; date at the top indicates the most recent revision.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="pt-6 border-t" style={{ borderColor: "var(--ak-rule)", fontFamily: "var(--font-heading)", fontSize: 28, letterSpacing: -0.6, lineHeight: 1.1, color: "var(--ak-ink)" }}>
              11. CONTACT
            </h2>
            <p>
              For privacy-related questions or requests, contact us at privacy@acoustickitty.ai.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
