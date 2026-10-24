-- CreateTable
CREATE TABLE "SyncState" (
    "address" TEXT NOT NULL PRIMARY KEY,
    "lastCheckpoint" INTEGER,
    "lastDigest" TEXT,
    "historyFromMs" DATETIME,
    "lastSyncedAt" DATETIME
);

-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "progress" TEXT NOT NULL DEFAULT '{}',
    "error" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("address", "key")
);

-- CreateTable
CREATE TABLE "LocalMemory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "namespace" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SyncRun_address_startedAt_idx" ON "SyncRun"("address", "startedAt");

-- CreateIndex
CREATE INDEX "MemoryWrite_address_status_idx" ON "MemoryWrite"("address", "status");

-- CreateIndex
CREATE INDEX "LocalMemory_namespace_createdAt_idx" ON "LocalMemory"("namespace", "createdAt");
