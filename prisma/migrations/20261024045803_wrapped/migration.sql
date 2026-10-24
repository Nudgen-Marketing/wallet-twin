-- CreateTable
CREATE TABLE "WrappedLine" (
    "address" TEXT NOT NULL PRIMARY KEY,
    "dataKey" TEXT NOT NULL,
    "line" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
