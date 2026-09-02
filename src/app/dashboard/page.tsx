import type { Metadata } from "next";
import { Suspense } from "react";
import { baseMetadata } from "@/lib/seo";
import { DashboardClient } from "./DashboardClient";

export function generateMetadata(): Metadata {
  return baseMetadata({
    title: "Subscriber Command Center",
    description:
      "Monitor your API usage, manage keys, and test agent endpoints from the subscriber command center.",
  });
}

export default function DashboardPage() {
  return (
    <Suspense>
      <DashboardClient />
    </Suspense>
  );
}
