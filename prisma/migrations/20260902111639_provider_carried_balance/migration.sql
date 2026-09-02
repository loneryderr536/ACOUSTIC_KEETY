-- CreateTable
CREATE TABLE "provider_balances" (
    "providerId" TEXT NOT NULL,
    "pendingCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'aud',
    "lastPeriodKey" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "provider_balances_pkey" PRIMARY KEY ("providerId")
);

-- AddForeignKey
ALTER TABLE "provider_balances" ADD CONSTRAINT "provider_balances_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
