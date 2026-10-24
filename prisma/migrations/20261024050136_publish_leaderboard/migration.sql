-- CreateTable
CREATE TABLE "PublicTwin" (
    "address" TEXT NOT NULL PRIMARY KEY,
    "publishedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LeaderboardEntry" (
    "address" TEXT NOT NULL PRIMARY KEY,
    "swaps" INTEGER NOT NULL,
    "closedTrades" INTEGER NOT NULL,
    "winRate" REAL,
    "realizedPnlUsd" REAL NOT NULL,
    "volumeUsd" REAL NOT NULL,
    "copyReturnPct" REAL,
    "favoriteToken" TEXT,
    "headline" TEXT,
    "updatedAt" DATETIME NOT NULL
);
