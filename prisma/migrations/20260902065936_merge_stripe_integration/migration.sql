-- Merge of the standalone Stripe service into the marketplace.
-- Purely additive: nothing is dropped, nothing is renamed.
--
-- NOTE: an earlier version of this migration, generated before `searchVector`
-- was declared in schema.prisma, also contained
--     DROP INDEX "Agent_searchVector_idx";
--     ALTER TABLE "Agent" DROP COLUMN "searchVector";
-- That was Prisma treating a raw-SQL column as schema drift, not an intended
-- change. Those statements have been removed. Do not let them come back — the
-- agent_search_update trigger writes to that column on every INSERT, so
-- dropping it makes every agent insert fail.

-- AlterTable
ALTER TABLE "Agent" ADD COLUMN     "native" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ApiCall" ADD COLUMN     "periodKey" TEXT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "periodKey" TEXT,
ADD COLUMN     "sharePct" DOUBLE PRECISION,
ADD COLUMN     "weightedCalls" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "chargesEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depositPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payoutsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revenue_periods" (
    "periodKey" TEXT NOT NULL,
    "subscriptionCents" INTEGER NOT NULL DEFAULT 0,
    "overageCents" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revenue_periods_pkey" PRIMARY KEY ("periodKey")
);

-- CreateIndex
CREATE INDEX "webhook_events_type_processedAt_idx" ON "webhook_events"("type", "processedAt");

-- CreateIndex
CREATE INDEX "ApiCall_periodKey_idx" ON "ApiCall"("periodKey");

-- CreateIndex
CREATE INDEX "Payout_providerId_periodKey_idx" ON "Payout"("providerId", "periodKey");
