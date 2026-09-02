-- AlterTable
ALTER TABLE "ApiCall" ADD COLUMN "creditsConsumed" INTEGER NOT NULL DEFAULT 0;

-- Backfill historical rows so existing payout aggregations don't
-- silently zero out. For each existing successful call, assume 1 credit
-- (Haiku-equivalent) since we don't have the agent's historical tier.
-- New calls will write the correct value going forward.
UPDATE "ApiCall" SET "creditsConsumed" = 1 WHERE "status" = 'success' AND "creditsConsumed" = 0;
