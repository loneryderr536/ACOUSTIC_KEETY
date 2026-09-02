import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Pin the workspace root to this repo.
  //
  // Without this, Turbopack infers the root by walking up looking for a
  // package.json / lockfile — and a stray `C:\Users\DELL\package.json` in the
  // home directory won that race, so module resolution ran from there instead
  // of from this folder. That produced "Can't resolve 'tailwindcss' in
  // 'C:\Users\DELL\Desktop'" even though tailwindcss is installed right here.
  //
  // Pinning it means the repo resolves against its own node_modules regardless
  // of what stray files sit above it on any given machine.
  turbopack: {
    root: dirname,
  },
  env: {
    NEXT_PUBLIC_GOOGLE_CLIENT_ID: (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "612995989678-j8lkoao47ngkhop7om73hjsfb08hk72o.apps.googleusercontent.com").trim(),
  },
};

export default nextConfig;
