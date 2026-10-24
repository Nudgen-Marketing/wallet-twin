-- CreateTable
CREATE TABLE "CoinInfo" (
    "coinType" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT,
    "name" TEXT,
    "decimals" INTEGER,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PriceCache" (
    "symbol" TEXT NOT NULL,
    "candleStart" DATETIME NOT NULL,
    "usd" REAL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("symbol", "candleStart")
);

-- CreateTable
CREATE TABLE "Activity" (
    "address" TEXT NOT NULL,
    "digest" TEXT NOT NULL,
    "checkpoint" INTEGER NOT NULL,
    "timestamp" DATETIME NOT NULL,
    "kind" TEXT NOT NULL,
    "usdValue" REAL,
    "data" TEXT NOT NULL,

    PRIMARY KEY ("address", "digest")
);

-- CreateIndex
CREATE INDEX "Activity_address_timestamp_idx" ON "Activity"("address", "timestamp");
