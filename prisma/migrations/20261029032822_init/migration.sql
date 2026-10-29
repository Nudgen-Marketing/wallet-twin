-- CreateTable
CREATE TABLE "User" (
    "address" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLogin" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "AuthNonce" (
    "nonce" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthNonce_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "CoinInfo" (
    "coinType" TEXT NOT NULL,
    "symbol" TEXT,
    "name" TEXT,
    "decimals" INTEGER,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinInfo_pkey" PRIMARY KEY ("coinType")
);

-- CreateTable
CREATE TABLE "PriceCache" (
    "symbol" TEXT NOT NULL,
    "candleStart" TIMESTAMP(3) NOT NULL,
    "usd" DOUBLE PRECISION,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceCache_pkey" PRIMARY KEY ("symbol","candleStart")
);

-- CreateTable
CREATE TABLE "Activity" (
    "address" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "checkpoint" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "kind" TEXT NOT NULL,
    "usdValue" DOUBLE PRECISION,
    "data" TEXT NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("address","digest")
);

-- CreateTable
CREATE TABLE "SyncState" (
    "address" TEXT NOT NULL,
    "lastCheckpoint" INTEGER,
    "lastDigest" TEXT,
    "historyFromMs" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "progress" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "SyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemoryWrite" (
    "address" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "backend" TEXT NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MemoryWrite_pkey" PRIMARY KEY ("address","key")
);

-- CreateTable
CREATE TABLE "LocalMemory" (
    "id" SERIAL NOT NULL,
    "namespace" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocalMemory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WrappedLine" (
    "address" TEXT NOT NULL,
    "dataKey" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WrappedLine_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "PublicTwin" (
    "address" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublicTwin_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "address" TEXT NOT NULL,
    "swaps" INTEGER NOT NULL,
    "closedTrades" INTEGER NOT NULL,
    "winRate" DOUBLE PRECISION,
    "realizedPnlUsd" DOUBLE PRECISION NOT NULL,
    "volumeUsd" DOUBLE PRECISION NOT NULL,
    "copyReturnPct" DOUBLE PRECISION,
    "favoriteToken" TEXT,
    "headline" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("address")
);

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "follower" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startingUsd" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "state" TEXT NOT NULL,
    "leaderBalances" TEXT NOT NULL,
    "lastCheckpoint" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPolledAt" TIMESTAMP(3),

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL,
    "followId" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "soldCoin" TEXT,
    "soldAmount" DOUBLE PRECISION,
    "boughtCoin" TEXT,
    "boughtAmount" DOUBLE PRECISION,
    "volumeUsd" DOUBLE PRECISION,
    "feeUsd" DOUBLE PRECISION,

    CONSTRAINT "PaperTrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT NOT NULL,
    "logoUri" TEXT,
    "clientUri" TEXT,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthGrant" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "demo" BOOLEAN NOT NULL DEFAULT false,
    "scopes" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthCode" (
    "codeHash" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "OAuthCode_pkey" PRIMARY KEY ("codeHash")
);

-- CreateTable
CREATE TABLE "OAuthToken" (
    "tokenHash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "rotatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "scopes" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthNonce_address_idx" ON "AuthNonce"("address");

-- CreateIndex
CREATE INDEX "Activity_address_timestamp_idx" ON "Activity"("address", "timestamp");

-- CreateIndex
CREATE INDEX "SyncRun_address_startedAt_idx" ON "SyncRun"("address", "startedAt");

-- CreateIndex
CREATE INDEX "MemoryWrite_address_status_idx" ON "MemoryWrite"("address", "status");

-- CreateIndex
CREATE INDEX "LocalMemory_namespace_createdAt_idx" ON "LocalMemory"("namespace", "createdAt");

-- CreateIndex
CREATE INDEX "Follow_leader_idx" ON "Follow"("leader");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_follower_leader_key" ON "Follow"("follower", "leader");

-- CreateIndex
CREATE INDEX "PaperTrade_followId_timestamp_idx" ON "PaperTrade"("followId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PaperTrade_followId_digest_key" ON "PaperTrade"("followId", "digest");

-- CreateIndex
CREATE INDEX "OAuthGrant_address_idx" ON "OAuthGrant"("address");

-- CreateIndex
CREATE INDEX "OAuthToken_grantId_idx" ON "OAuthToken"("grantId");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "ApiKey_address_idx" ON "ApiKey"("address");
