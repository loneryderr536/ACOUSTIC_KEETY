import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";
import { ProviderDashboardClient } from "./ProviderDashboardClient";

export function generateMetadata(): Metadata {
  return baseMetadata({
    title: "Provider Command Center",
    description:
      "Manage your agents, view performance metrics, and trigger benchmarks from the provider command center.",
  });
}

export default function ProviderDashboardPage() {
  return <ProviderDashboardClient />;
}
