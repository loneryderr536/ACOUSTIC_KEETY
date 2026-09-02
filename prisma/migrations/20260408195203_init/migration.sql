-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" TEXT NOT NULL DEFAULT 'subscriber',
    "apiKey" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'explorer',
    "callsUsed" INTEGER NOT NULL DEFAULT 0,
    "callsLimit" INTEGER NOT NULL DEFAULT 500,
    "stripeCustomerId" TEXT,
    "stripeAccountId" TEXT,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Agent" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "shortDesc" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "tags" TEXT[],
    "providerId" TEXT NOT NULL,
    "endpointUrl" TEXT NOT NULL,
    "connectorType" TEXT NOT NULL DEFAULT 'api',
    "authType" TEXT NOT NULL DEFAULT 'none',
    "authToken" TEXT,
    "pricingModel" TEXT NOT NULL DEFAULT 'usage',
    "pricePerCall" INTEGER NOT NULL DEFAULT 20,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "logoUrl" TEXT,
    "docsUrl" TEXT,
    "repoUrl" TEXT,
    "mcpServerUrl" TEXT,
    "currentScore" DOUBLE PRECISION,
    "latencyP50" INTEGER,
    "latencyP95" INTEGER,
    "uptime" DOUBLE PRECISION DEFAULT 100,
    "errorRate" DOUBLE PRECISION DEFAULT 0,
    "currentRank" INTEGER,
    "trendDelta" DOUBLE PRECISION DEFAULT 0,
    "totalCalls" INTEGER NOT NULL DEFAULT 0,
    "rating" DOUBLE PRECISION DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Benchmark" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "accuracy" DOUBLE PRECISION NOT NULL,
    "latencyP50" INTEGER NOT NULL,
    "latencyP95" INTEGER NOT NULL,
    "errorRate" DOUBLE PRECISION NOT NULL,
    "edgeCaseScore" DOUBLE PRECISION NOT NULL,
    "testSuiteVer" TEXT NOT NULL DEFAULT 'v1',
    "rawResults" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Benchmark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiCall" (
    "id" TEXT NOT NULL,
    "callId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "routingStrategy" TEXT NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "requestSize" INTEGER NOT NULL DEFAULT 0,
    "responseSize" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiCall_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "Agent_slug_key" ON "Agent"("slug");

-- CreateIndex
CREATE INDEX "Agent_category_status_idx" ON "Agent"("category", "status");

-- CreateIndex
CREATE INDEX "Agent_status_currentScore_idx" ON "Agent"("status", "currentScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Benchmark_runId_key" ON "Benchmark"("runId");

-- CreateIndex
CREATE INDEX "Benchmark_agentId_createdAt_idx" ON "Benchmark"("agentId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ApiCall_callId_key" ON "ApiCall"("callId");

-- CreateIndex
CREATE INDEX "ApiCall_subscriberId_createdAt_idx" ON "ApiCall"("subscriberId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ApiCall_agentId_createdAt_idx" ON "ApiCall"("agentId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "HealthCheck_agentId_createdAt_idx" ON "HealthCheck"("agentId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Review_agentId_userId_key" ON "Review"("agentId", "userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Agent" ADD CONSTRAINT "Agent_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Benchmark" ADD CONSTRAINT "Benchmark_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCall" ADD CONSTRAINT "ApiCall_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApiCall" ADD CONSTRAINT "ApiCall_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthCheck" ADD CONSTRAINT "HealthCheck_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
