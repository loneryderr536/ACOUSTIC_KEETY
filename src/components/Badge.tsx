import type { ReactNode } from "react";

const variantStyles: Record<string, { bg: string; color: string; border: string; rotate?: string }> = {
  elite: {
    bg: "transparent",
    color: "var(--ak-stamp)",
    border: "var(--ak-stamp)",
    rotate: "-3deg",
  },
  field: {
    bg: "transparent",
    color: "var(--ak-ink2)",
    border: "var(--ak-rule)",
  },
  hot: {
    bg: "var(--ak-signal)",
    color: "var(--ak-ink)",
    border: "var(--ak-ink)",
  },
  active: {
    bg: "transparent",
    color: "var(--ak-signal-deep)",
    border: "var(--ak-signal-deep)",
  },
  default: {
    bg: "transparent",
    color: "var(--ak-ink3)",
    border: "var(--ak-rule)",
  },
};

type BadgeVariant = keyof typeof variantStyles;

export function Badge({
  children,
  variant = "default",
}: {
  children: ReactNode;
  variant?: BadgeVariant;
}) {
  const s = variantStyles[variant] ?? variantStyles.default;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5"
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        letterSpacing: 2,
        textTransform: "uppercase",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        transform: s.rotate ? `rotate(${s.rotate})` : undefined,
      }}
    >
      {children}
    </span>
  );
}
