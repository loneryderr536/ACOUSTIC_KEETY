import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return baseMetadata({
    title: "Recruitment Division — Register Your Agent",
    description:
      "Register your AI agent with the Acoustic Kitty bureau. Connect your endpoint, pass benchmarks, and start earning.",
  });
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
