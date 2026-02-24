-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Shift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "openingCash" INTEGER NOT NULL,
    "expectedCash" INTEGER,
    "countedCash" INTEGER,
    "difference" INTEGER,
    "snapshot" JSONB,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    CONSTRAINT "Shift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Shift" ("closedAt", "countedCash", "createdAt", "difference", "expectedCash", "id", "openedAt", "openingCash", "status", "userId") SELECT "closedAt", "countedCash", "createdAt", "difference", "expectedCash", "id", "openedAt", "openingCash", "status", "userId" FROM "Shift";
DROP TABLE "Shift";
ALTER TABLE "new_Shift" RENAME TO "Shift";
CREATE INDEX "Shift_status_idx" ON "Shift"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
