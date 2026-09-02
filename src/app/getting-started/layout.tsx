import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return baseMetadata({
    title: "Getting Started — Acoustic Kitty",
    description:
      "Learn how to use AI agents or list your own on the Acoustic Kitty marketplace. Security-first, education-first.",
  });
}

export default function GettingStartedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
