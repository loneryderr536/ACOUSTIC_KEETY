'use client';

import { useState } from 'react';
import { useSubscriber } from '@/lib/useSubscriber';
import { toast } from 'sonner';
import { BotQR } from '@/components/BotQR';

const paperBg = {
  background: "var(--ak-paper)",
  backgroundImage: `
    radial-gradient(circle at 20% 30%, rgba(0,0,0,0.015) 0%, transparent 40%),
    radial-gradient(circle at 80% 70%, rgba(0,0,0,0.018) 0%, transparent 40%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.035 0'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23n)'/%3E%3C/svg%3E")
  `,
};

export default function LinkPage() {
  const { apiKey } = useSubscriber();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  const handleLink = async () => {
    if (!apiKey || !code.trim()) return;
    setStatus('loading');

    try {
      const res = await fetch('/api/messaging/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      if (res.ok) {
        setStatus('success');
        toast.success('Account linked! You can now use Acoustic Kitty on Telegram.');
      } else {
        const data = await res.json();
        setStatus('error');
        toast.error(data.error || 'Invalid or expired code. Try /start again in Telegram.');
      }
    } catch {
      setStatus('error');
      toast.error('Something went wrong. Try again.');
    }
  };

  if (!apiKey) {
    return (
      <section
        style={{ ...paperBg, minHeight: "60vh" }}
        className="flex items-center justify-center px-8"
      >
        <div className="flex flex-col items-center text-center gap-6 max-w-md">
          <BotQR size={148} caption="Scan to open @AcoustickittyBot" />
          <div>
            <p
              className="mb-1"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: 2,
                color: "var(--ak-ink3)",
              }}
            >
              /LINK TELEGRAM
            </p>
            <p
              className="mb-4"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 15,
                lineHeight: 1.5,
                color: "var(--ak-ink2)",
              }}
            >
              Open the bot, send <span style={{ fontFamily: "var(--font-mono)" }}>/start</span>, then sign in here to paste the code.
            </p>
            <a
              href="/signup"
              className="underline"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: 2,
                color: "var(--ak-ink)",
              }}
            >
              SIGN IN →
            </a>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      style={{ ...paperBg, minHeight: "70vh" }}
      className="flex items-center justify-center px-8 py-20"
    >
      <div className="max-w-lg w-full">
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
            <span>/TELEGRAM LINK</span>
            <span>FORM AK-LK</span>
          </div>

          <h1
            className="mb-3"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: "clamp(40px, 6vw, 64px)",
              lineHeight: 0.95,
              letterSpacing: -1.4,
              color: "var(--ak-ink)",
            }}
          >
            Link account.
          </h1>

          {status === 'success' ? (
            <div
              className="border p-5 mt-5"
              style={{
                borderColor: "var(--ak-signal-deep)",
                background: "rgba(198,255,46,0.08)",
              }}
            >
              <span
                className="block mb-1"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 2,
                  color: "var(--ak-signal-deep)",
                }}
              >
                SUCCESS
              </span>
              <p
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  color: "var(--ak-ink)",
                }}
              >
                Account linked successfully. Return to Telegram and start chatting.
              </p>
            </div>
          ) : (
            <>
              <p
                className="mt-2 mb-6"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  lineHeight: 1.55,
                  color: "var(--ak-ink2)",
                }}
              >
                Open the bot on Telegram, send <span style={{ fontFamily: "var(--font-mono)" }}>/start</span>, then paste the 6-digit code here.
              </p>

              <div
                className="flex justify-center mb-6 pb-6 border-b"
                style={{ borderColor: "var(--ak-rule)" }}
              >
                <BotQR size={140} caption="New here? Scan to open @AcoustickittyBot" compact />
              </div>

              <div
                className="mb-3"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  letterSpacing: 1.5,
                  color: "var(--ak-ink3)",
                }}
              >
                01 &nbsp; VERIFICATION CODE
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Enter code"
                  maxLength={6}
                  className="flex-1 px-4 py-3 text-center focus:outline-none"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 18,
                    letterSpacing: "0.3em",
                    textTransform: "uppercase",
                    background: "var(--ak-paper)",
                    border: "1px solid var(--ak-ink)",
                    color: "var(--ak-ink)",
                  }}
                />
                <button
                  onClick={handleLink}
                  disabled={!code.trim() || status === 'loading'}
                  className="px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 13,
                    fontWeight: 500,
                    background: "var(--ak-signal)",
                    color: "var(--ak-ink)",
                    border: "1px solid var(--ak-ink)",
                    textTransform: "uppercase",
                  }}
                >
                  {status === 'loading' ? 'Linking...' : 'Link'}
                </button>
              </div>
              {status === 'error' && (
                <p
                  className="mt-3"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: 1,
                    color: "var(--ak-stamp)",
                  }}
                >
                  Invalid or expired code. Send /start in Telegram for a new one.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
