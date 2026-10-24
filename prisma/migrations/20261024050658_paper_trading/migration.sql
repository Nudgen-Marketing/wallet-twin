-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "follower" TEXT NOT NULL,
    "leader" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startingUsd" REAL NOT NULL DEFAULT 1000,
    "state" TEXT NOT NULL,
    "leaderBalances" TEXT NOT NULL,
    "lastCheckpoint" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPolledAt" DATETIME
);

-- CreateTable
CREATE TABLE "PaperTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "followId" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "soldCoin" TEXT,
    "soldAmount" REAL,
    "boughtCoin" TEXT,
    "boughtAmount" REAL,
    "volumeUsd" REAL,
    "feeUsd" REAL
);

-- CreateIndex
CREATE INDEX "Follow_leader_idx" ON "Follow"("leader");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_follower_leader_key" ON "Follow"("follower", "leader");

-- CreateIndex
CREATE INDEX "PaperTrade_followId_timestamp_idx" ON "PaperTrade"("followId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "PaperTrade_followId_digest_key" ON "PaperTrade"("followId", "digest");
