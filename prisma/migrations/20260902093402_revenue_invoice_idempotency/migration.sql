-- CreateTable
CREATE TABLE "revenue_invoices" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "subscriptionCents" INTEGER NOT NULL,
    "overageCents" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revenue_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "revenue_invoices_periodKey_idx" ON "revenue_invoices"("periodKey");
