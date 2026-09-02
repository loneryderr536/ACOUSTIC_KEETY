-- AlterTable
ALTER TABLE "Agent" ADD COLUMN IF NOT EXISTS "depositPaidAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "depositPaymentIntentId" TEXT,
ADD COLUMN IF NOT EXISTS "depositStatus" TEXT,
ADD COLUMN IF NOT EXISTS "hasAgentCard" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "skillsData" JSONB;
ALTER TABLE "Agent" ALTER COLUMN "pricingModel" SET DEFAULT 'platform';

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "callsBalance" INTEGER NOT NULL DEFAULT 500,
ADD COLUMN IF NOT EXISTS "dailyAllowance" INTEGER NOT NULL DEFAULT 17,
ADD COLUMN IF NOT EXISTS "dailyCeiling" INTEGER NOT NULL DEFAULT 34,
ADD COLUMN IF NOT EXISTS "lastReplenishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "User" ALTER COLUMN "plan" SET DEFAULT 'recruit';

-- CreateTable (idempotent)
CREATE TABLE IF NOT EXISTS "MessagingLink" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagingLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (idempotent)
CREATE INDEX IF NOT EXISTS "MessagingLink_userId_idx" ON "MessagingLink"("userId");

-- CreateIndex (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS "MessagingLink_platform_platformUserId_key" ON "MessagingLink"("platform", "platformUserId");

-- Deduplicate Agent names: append slug suffix to newer duplicates
UPDATE "Agent" a
SET name = a.name || '-' || substring(a.slug from '-([^-]+)$')
WHERE a.id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY "createdAt") AS rn
    FROM "Agent"
  ) ranked
  WHERE rn > 1
)
AND a.slug ~ '-[^-]+$';

-- For any remaining duplicates (no slug suffix), append id fragment
UPDATE "Agent" a
SET name = a.name || '-' || substring(a.id, 1, 6)
WHERE a.id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY name ORDER BY "createdAt") AS rn
    FROM "Agent"
  ) ranked
  WHERE rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "Agent_name_key" ON "Agent"("name");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessagingLink" ADD CONSTRAINT "MessagingLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
