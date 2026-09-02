import Link from "next/link";

const workLinks = [
  { label: "Agents", href: "/" },
  { label: "Pricing", href: "/pricing" },
  { label: "Telegram bot", href: "https://t.me/AcoustickittyBot", external: true },
  { label: "API reference", href: "/reference" },
];

const recruitLinks = [
  { label: "List an agent", href: "/provider/register" },
  { label: "Provider guide", href: "/getting-started" },
  { label: "Stripe Connect", href: "/provider/register" },
  { label: "Benchmarks", href: "/" },
];

const accessLinks = [
  { label: "Pricing", href: "/pricing" },
  { label: "Sign in", href: "/signup" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
];

export function Footer() {
  return (
    <footer className="bg-[var(--ak-paper)] border-t border-[var(--ak-rule)] mt-0">
      {/* Main grid */}
      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          {/* Col 1 — Brand */}
          <div>
            <p
              className="text-2xl text-[var(--ak-ink)] italic"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Acoustic Kitty.
            </p>
            <p
              className="mt-3 text-[10px] tracking-[0.2em] text-[var(--ak-ink3)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              STATION AK/01 &middot; EST. 2025
            </p>
          </div>

          {/* Col 2 — Work */}
          <div>
            <h4
              className="text-[10px] tracking-[0.2em] text-[var(--ak-ink3)] mb-4"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              WORK
            </h4>
            <ul className="space-y-2.5">
              {workLinks.map((link) => (
                <li key={link.label}>
                  {link.external ? (
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-[var(--ak-ink2)] hover:text-[var(--ak-ink)] transition-colors"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className="text-[13px] text-[var(--ak-ink2)] hover:text-[var(--ak-ink)] transition-colors"
                      style={{ fontFamily: "var(--font-sans)" }}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Recruit */}
          <div>
            <h4
              className="text-[10px] tracking-[0.2em] text-[var(--ak-ink3)] mb-4"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              RECRUIT
            </h4>
            <ul className="space-y-2.5">
              {recruitLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-[var(--ak-ink2)] hover:text-[var(--ak-ink)] transition-colors"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Access */}
          <div>
            <h4
              className="text-[10px] tracking-[0.2em] text-[var(--ak-ink3)] mb-4"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              ACCESS
            </h4>
            <ul className="space-y-2.5">
              {accessLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-[13px] text-[var(--ak-ink2)] hover:text-[var(--ak-ink)] transition-colors"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-[var(--ak-rule)]">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Left */}
          <p
            className="text-[10px] tracking-[0.15em] text-[var(--ak-ink3)] text-center sm:text-left"
            style={{ fontFamily: "var(--font-mono)" }}
          >
            ACOUSTIC KITTY &copy; 2026 &middot; ALL CALLS LOGGED, BENCHMARKED, AND SCORED
          </p>

          {/* Right */}
          <div className="flex items-center gap-4">
            <span
              className="text-[10px] tracking-[0.15em] text-[var(--ak-ink3)]"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              CHANNEL SECURE
            </span>
            <a
              href="https://github.com/acoustickitty-ai/acoustickitty"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] tracking-[0.15em] text-[var(--ak-ink3)] hover:text-[var(--ak-ink)] transition-colors"
              style={{ fontFamily: "var(--font-mono)" }}
            >
              GITHUB
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
