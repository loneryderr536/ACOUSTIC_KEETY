import type { ReactNode } from "react";
import { Instrument_Serif, Inter_Tight, JetBrains_Mono } from "next/font/google";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { GrainOverlay } from "@/components/GrainOverlay";
import { Toaster } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { JsonLd } from "@/components/JsonLd";
import { baseMetadata, websiteJsonLd, organizationJsonLd, softwareApplicationJsonLd } from "@/lib/seo";
import "./globals.css";
import { cn } from "@/lib/utils";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-heading",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
});

export const metadata = baseMetadata();

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={cn(
        instrumentSerif.variable,
        interTight.variable,
        jetbrainsMono.variable,
        "dark"
      )}
    >
      <body
        className="min-h-screen antialiased flex flex-col"
        style={{ background: "var(--ak-paper)", color: "var(--ak-ink)" }}
      >
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <CookieConsent />
        <Toaster />
        <JsonLd data={websiteJsonLd()} />
        <JsonLd data={organizationJsonLd()} />
        <JsonLd data={softwareApplicationJsonLd()} />
      </body>
    </html>
  );
}
