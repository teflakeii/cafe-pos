-- CreateTable
CREATE TABLE "FinancialEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "note" TEXT,
    "orderId" INTEGER,
    "tableId" INTEGER,
    "orderItemId" TEXT,
    "paymentId" TEXT,
    "source" TEXT
);

-- CreateIndex
CREATE INDEX "FinancialEntry_createdAt_idx" ON "FinancialEntry"("createdAt");

-- CreateIndex
CREATE INDEX "FinancialEntry_type_idx" ON "FinancialEntry"("type");

-- CreateIndex
CREATE INDEX "FinancialEntry_orderId_idx" ON "FinancialEntry"("orderId");

-- CreateIndex
CREATE INDEX "FinancialEntry_tableId_idx" ON "FinancialEntry"("tableId");
