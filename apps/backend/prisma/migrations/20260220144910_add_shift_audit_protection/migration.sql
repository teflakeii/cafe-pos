-- CreateTable
CREATE TABLE "ShiftAudit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shiftId" INTEGER NOT NULL,
    "closedBy" INTEGER,
    "closedAt" DATETIME NOT NULL,
    "revenue" INTEGER NOT NULL,
    "difference" INTEGER NOT NULL,
    "anomalyFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftAudit_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftAudit_closedBy_fkey" FOREIGN KEY ("closedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ShiftAudit_shiftId_idx" ON "ShiftAudit"("shiftId");

-- CreateIndex
CREATE INDEX "ShiftAudit_closedAt_idx" ON "ShiftAudit"("closedAt");

-- CreateIndex
CREATE INDEX "ShiftAudit_anomalyFlag_idx" ON "ShiftAudit"("anomalyFlag");
