'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'ak_consent';
const LEGACY_KEY = 'hoa_consent';

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const current = localStorage.getItem(STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (current) return;
    if (legacy) {
      // one-time migration — don't re-prompt users who already dismissed
      localStorage.setItem(STORAGE_KEY, legacy);
      localStorage.removeItem(LEGACY_KEY);
      return;
    }
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'acknowledged');
    setShow(false);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50"
      role="region"
      aria-label="Local storage notice"
      style={{
        background: 'var(--ak-paper)',
        borderTop: '1px solid var(--ak-ink)',
      }}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-10 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div
          className="shrink-0"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.2em',
            color: 'var(--ak-ink3)',
          }}
        >
          /LOCAL STORAGE NOTICE
        </div>
        <p
          className="flex-1"
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--ak-ink2)',
          }}
        >
          Acoustic Kitty stores your API key and preferences in this browser so you stay signed in and your settings persist. No tracking cookies, no third-party analytics.{' '}
          <a
            href="/privacy"
            className="underline hover:opacity-70 transition-opacity"
            style={{ color: 'var(--ak-ink)' }}
          >
            Privacy policy
          </a>
          .
        </p>
        <button
          onClick={dismiss}
          className="shrink-0 cursor-pointer hover:opacity-70 transition-opacity"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            background: 'var(--ak-ink)',
            color: 'var(--ak-paper)',
            border: '1px solid var(--ak-ink)',
            padding: '10px 18px',
          }}
        >
          Got it
        </button>
      </div>
    </div>
  );
}
