// Prisma 7 no longer auto-loads .env for CLI commands — that job moved to this
// config file. Without this import, `prisma migrate` / `prisma studio` see an
// empty DATABASE_URL and fail with "Connection url is empty", even when .env is
// sitting right there. (prisma/seed.ts imports it separately for the same reason.)
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL || "",
  },
});
