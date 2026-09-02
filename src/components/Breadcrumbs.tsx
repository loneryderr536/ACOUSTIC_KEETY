import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "./JsonLd";

interface BreadcrumbItem {
  name: string;
  href: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  const jsonLdData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.href,
    })),
  };

  return (
    <>
      <JsonLd data={jsonLdData} />
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: 1.5,
          color: "var(--ak-ink3)",
          textTransform: "uppercase",
        }}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <span key={item.href} className="flex items-center gap-1.5">
              {index > 0 && (
                <ChevronRight size={11} style={{ color: "var(--ak-rule)" }} />
              )}
              {isLast ? (
                <span style={{ color: "var(--ak-ink)" }}>{item.name}</span>
              ) : (
                <Link
                  href={item.href}
                  className="hover:opacity-70 transition-opacity"
                  style={{ color: "var(--ak-ink3)" }}
                >
                  {item.name}
                </Link>
              )}
            </span>
          );
        })}
      </nav>
    </>
  );
}
