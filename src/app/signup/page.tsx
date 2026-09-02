"use client";

import { Suspense, useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { useSubscriber } from "@/lib/useSubscriber";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (element: HTMLElement, config: Record<string, unknown>) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

const paperBg = {
  background: "var(--ak-paper)",
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(0,0,0,0.015) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(0,0,0,0.018) 0%, transparent 40%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")
  `,
};

function SignUpPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawRedirect = searchParams.get("redirect");
  const redirect = rawRedirect && rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : null;
  const { signIn } = useSubscriber();
  const googleBtnRef = useRef<HTMLDivElement>(null);

  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ apiKey: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGoogleResponse = useCallback(async (response: { credential: string }) => {
    setError("");
    setGoogleLoading(true);
    try {
      const res = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Google sign-in failed. Please try again.");
        return;
      }
      signIn(data.apiKey, data.name);
      if (data.isNew) {
        setResult({ apiKey: data.apiKey });
      } else {
        router.push(redirect || "/");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  }, [signIn, redirect, router]);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !window.google || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline",
      size: "large",
      width: 400,
      text: "continue_with",
      shape: "rectangular",
    });
  }, [handleGoogleResponse]);

  function initGoogle() {
    if (!GOOGLE_CLIENT_ID || !window.google || !googleBtnRef.current) return;
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleResponse,
    });
    window.google.accounts.id.renderButton(googleBtnRef.current, {
      theme: "outline",
      size: "large",
      width: 400,
      text: "continue_with",
      shape: "rectangular",
    });
  }

  function copyKey() {
    if (result) {
      navigator.clipboard.writeText(result.apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
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
          <span>FILE NO. AK—INTAKE/01</span>
          <span>◆ RECRUIT CLEARANCE</span>
        </div>

        <div className="max-w-4xl">
          <h1
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(64px, 10vw, 144px)",
              lineHeight: 0.88,
              letterSpacing: -4,
              color: "var(--ak-ink)",
            }}
          >
            Start <span className="italic">free.</span>
          </h1>
          <p
            className="mt-6 border-t pt-5 max-w-[540px]"
            style={{
              borderColor: "var(--ak-rule)",
              fontFamily: "var(--font-sans)",
              fontSize: 18,
              lineHeight: 1.5,
              color: "var(--ak-ink2)",
            }}
          >
            Create your free account to start using AI agents.
          </p>
        </div>
      </section>

      {/* ═══════════ INTAKE FORM ═══════════ */}
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
              <span>/INTAKE BRIEF</span>
              <span>FORM AK-01</span>
            </div>

            {!result ? (
              <div className="space-y-6">
                {error && (
                  <div
                    className="border p-3"
                    style={{ borderColor: "var(--ak-stamp)", background: "rgba(178,58,42,0.06)" }}
                  >
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: 2,
                        color: "var(--ak-stamp)",
                      }}
                    >
                      ERROR
                    </div>
                    <p
                      className="mt-1"
                      style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--ak-ink)" }}
                    >
                      {error}
                    </p>
                  </div>
                )}

                {GOOGLE_CLIENT_ID ? (
                  <>
                    <Script
                      src="https://accounts.google.com/gsi/client"
                      onLoad={initGoogle}
                    />
                    <div>
                      <div
                        className="mb-2"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          letterSpacing: 1.5,
                          color: "var(--ak-ink3)",
                        }}
                      >
                        01 &nbsp; IDENTITY
                      </div>
                      <div className="flex justify-center">
                        <div ref={googleBtnRef} />
                      </div>
                    </div>
                    {googleLoading && (
                      <p
                        className="text-center"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          letterSpacing: 1.5,
                          color: "var(--ak-ink3)",
                        }}
                      >
                        Signing in with Google...
                      </p>
                    )}
                  </>
                ) : (
                  <p
                    className="text-center"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 14,
                      color: "var(--ak-ink3)",
                    }}
                  >
                    Sign-in is temporarily unavailable. Please try again later.
                  </p>
                )}

                <p
                  className="text-center"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 12,
                    color: "var(--ak-ink3)",
                    lineHeight: 1.5,
                  }}
                >
                  By signing in, you agree to our{" "}
                  <Link href="/terms" className="underline" style={{ color: "var(--ak-ink2)" }}>
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="underline" style={{ color: "var(--ak-ink2)" }}>
                    Privacy Policy
                  </Link>
                  .
                </p>

                <p
                  className="text-center"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: 1.2,
                    color: "var(--ak-ink3)",
                  }}
                >
                  Already have an API key?{" "}
                  <Link href="/dashboard" className="underline" style={{ color: "var(--ak-ink)" }}>
                    Sign in on Dashboard
                  </Link>
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: "var(--ak-signal-deep)",
                      boxShadow: "0 0 0 3px rgba(198,255,46,0.2)",
                    }}
                  />
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      letterSpacing: 2,
                      color: "var(--ak-signal-deep)",
                    }}
                  >
                    ACCOUNT CREATED
                  </span>
                </div>

                <div>
                  <span
                    className="block mb-2"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: 2,
                      color: "var(--ak-ink3)",
                    }}
                  >
                    YOUR API KEY
                  </span>
                  <div
                    className="flex items-center gap-2 p-3"
                    style={{ border: "1px solid var(--ak-ink)", background: "var(--ak-paper)" }}
                  >
                    <code
                      className="flex-1 break-all"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 13,
                        color: "var(--ak-ink)",
                      }}
                    >
                      {result.apiKey}
                    </code>
                    <button
                      onClick={copyKey}
                      className="shrink-0 px-3 py-1.5 cursor-pointer"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: 2,
                        border: "1px solid var(--ak-ink)",
                        background: copied ? "var(--ak-signal)" : "transparent",
                        color: "var(--ak-ink)",
                      }}
                    >
                      {copied ? "COPIED" : "COPY"}
                    </button>
                  </div>
                  <p
                    className="mt-2"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: 1,
                      color: "var(--ak-stamp)",
                    }}
                  >
                    Save this key — it won&apos;t be shown again.
                  </p>
                </div>

                <div
                  className="border-t pt-6 space-y-4"
                  style={{ borderColor: "var(--ak-rule)" }}
                >
                  <p
                    className="text-center"
                    style={{
                      fontFamily: "var(--font-sans)",
                      fontSize: 14,
                      lineHeight: 1.55,
                      color: "var(--ak-ink2)",
                    }}
                  >
                    You&apos;re signed in with 500 free calls per month.
                    <br />
                    <Link
                      href="/getting-started"
                      className="underline"
                      style={{ color: "var(--ak-ink)" }}
                    >
                      Read the quick start guide →
                    </Link>
                  </p>
                  <div className="flex flex-col gap-2">
                    {redirect ? (
                      <Link
                        href={redirect}
                        className="w-full px-6 py-3.5 text-center"
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 13,
                          fontWeight: 500,
                          background: "var(--ak-signal)",
                          color: "var(--ak-ink)",
                          border: "1px solid var(--ak-ink)",
                        }}
                      >
                        RETURN TO AGENT ↗
                      </Link>
                    ) : (
                      <Link
                        href="/"
                        className="w-full px-6 py-3.5 text-center"
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 13,
                          fontWeight: 500,
                          background: "var(--ak-signal)",
                          color: "var(--ak-ink)",
                          border: "1px solid var(--ak-ink)",
                        }}
                      >
                        EXPLORE AGENTS ↗
                      </Link>
                    )}
                    <Link
                      href="/dashboard"
                      className="w-full px-6 py-3.5 text-center"
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        fontWeight: 500,
                        background: "transparent",
                        color: "var(--ak-ink)",
                        border: "1px solid var(--ak-ink)",
                      }}
                    >
                      VIEW DASHBOARD
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

export default function SignUpPageWrapper() {
  return (
    <Suspense fallback={null}>
      <SignUpPage />
    </Suspense>
  );
}
