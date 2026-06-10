-- CreateTable
CREATE TABLE "Idempotency" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "responseHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Idempotency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Idempotency_endpoint_idx" ON "Idempotency"("endpoint");

-- CreateIndex
CREATE INDEX "Idempotency_createdAt_idx" ON "Idempotency"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Idempotency_key_userId_endpoint_key" ON "Idempotency"("key", "userId", "endpoint");
