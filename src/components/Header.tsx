"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useSubscriber } from "@/lib/useSubscriber";

const navLinks = [
  { label: "AGENTS", href: "/" },
  { label: "PRICING", href: "/pricing" },
  { label: "DEVELOPERS", href: "/getting-started" },
  { label: "PROVIDERS", href: "/provider/register" },
];

function UTCClock() {
  const [time, setTime] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          timeZone: "UTC",
        })
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span
      className="text-[10px] tracking-[0.12em] text-[var(--ak-ink3)] tabular-nums"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {time}&nbsp;UTC
    </span>
  );
}

function Pipe() {
  return (
    <span className="text-[var(--ak-rule)] text-[10px] mx-1 select-none">
      |
    </span>
  );
}

function AuthControls() {
  const { isSignedIn, name, signOut } = useSubscriber();

  if (!isSignedIn) {
    return (
      <Link
        href="/signup"
        className="text-[10px] tracking-[0.15em] uppercase text-[var(--ak-ink)] hover:text-[var(--ak-stamp)] transition-colors"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        SIGN IN
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span
        className="text-[10px] tracking-[0.12em] text-[var(--ak-ink3)] hidden sm:inline"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {name}
      </span>
      <Link
        href="/dashboard"
        className="text-[10px] tracking-[0.15em] uppercase text-[var(--ak-ink2)] hover:text-[var(--ak-ink)] transition-colors"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        DASHBOARD
      </Link>
      <button
        onClick={signOut}
        className="text-[10px] tracking-[0.15em] uppercase text-[var(--ak-ink3)] hover:text-[var(--ak-stamp)] transition-colors cursor-pointer"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        LOG OUT
      </button>
    </div>
  );
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { isSignedIn } = useSubscriber();

  // Track scroll for background transition
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 10);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const toggleMenu = useCallback(() => setMenuOpen((prev) => !prev), []);

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 h-10 transition-colors duration-300 border-b border-[var(--ak-rule)] ${
          scrolled ? "bg-[var(--ak-paper)]" : "bg-transparent"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 h-full flex items-center justify-between">
          {/* Left — wordmark */}
          <Link
            href="/"
            className="italic hover:opacity-70 transition-opacity"
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 18,
              letterSpacing: -0.3,
              color: "var(--ak-ink)",
            }}
          >
            Acoustic Kitty.
          </Link>

          {/* Right — auth, hamburger */}
          <div className="flex items-center gap-0">
            <div className="hidden sm:flex items-center">
              <AuthControls />
            </div>

            <div className="flex sm:hidden items-center gap-2">
              <AuthControls />
              <button
                onClick={toggleMenu}
                className="flex items-center justify-center w-10 h-10 text-[var(--ak-ink2)] hover:text-[var(--ak-ink)] transition-colors cursor-pointer"
                aria-label="Toggle menu"
              >
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile slide-out menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 sm:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[var(--ak-ink)]/60 backdrop-blur-sm"
            onClick={toggleMenu}
          />
          {/* Panel */}
          <div className="absolute top-10 right-0 w-64 h-[calc(100vh-2.5rem)] bg-[var(--ak-paper)] border-l border-[var(--ak-rule)] flex flex-col">
            <nav className="flex-1 px-6 py-8 space-y-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block py-3 text-[11px] tracking-[0.25em] uppercase border-b border-[var(--ak-rule-soft)] transition-colors ${
                    pathname === link.href
                      ? "text-[var(--ak-stamp)]"
                      : "text-[var(--ak-ink2)] hover:text-[var(--ak-ink)]"
                  }`}
                  style={{ fontFamily: "var(--font-mono)" }}
                >
                  {link.label}
                </Link>
              ))}

              <div className="pt-4 border-b border-[var(--ak-rule-soft)] pb-3">
                {isSignedIn ? (
                  <Link
                    href="/dashboard"
                    className="block py-3 text-[11px] tracking-[0.25em] uppercase text-[var(--ak-ink)] hover:text-[var(--ak-stamp)] transition-colors"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    DASHBOARD
                  </Link>
                ) : (
                  <Link
                    href="/signup"
                    className="block py-3 text-[11px] tracking-[0.25em] uppercase text-[var(--ak-ink)] hover:text-[var(--ak-stamp)] transition-colors"
                    style={{ fontFamily: "var(--font-mono)" }}
                  >
                    SIGN IN
                  </Link>
                )}
              </div>
            </nav>

            {/* Bottom status */}
            <div className="px-6 py-4 border-t border-[var(--ak-rule)] flex items-center justify-between">
              <UTCClock />
              <span
                className="flex items-center gap-1.5 text-[10px] tracking-[0.12em] text-[var(--ak-ink3)]"
                style={{ fontFamily: "var(--font-mono)" }}
              >
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--ak-signal)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--ak-signal)]" />
                </span>
                LIVE
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
