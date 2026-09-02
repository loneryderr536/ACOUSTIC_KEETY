import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "612995989678-j8lkoao47ngkhop7om73hjsfb08hk72o.apps.googleusercontent.com").trim(),
  },
};

export default nextConfig;
