-- AlterTable
ALTER TABLE "revenue_invoices" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'aud',
ADD COLUMN     "pooled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "revenue_periods" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'aud';

-- CreateIndex
CREATE INDEX "revenue_invoices_periodKey_pooled_idx" ON "revenue_invoices"("periodKey", "pooled");
