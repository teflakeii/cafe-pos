/*
  Warnings:

  - You are about to drop the column `attachmentPath` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `note` on the `Expense` table. All the data in the column will be lost.
  - You are about to drop the column `spentAt` on the `Expense` table. All the data in the column will be lost.
  - Added the required column `description` to the `Expense` table without a default value. This is not possible if the table is not empty.
  - Added the required column `shiftId` to the `Expense` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "shiftId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "createdBy" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" DATETIME,
    "voidedBy" INTEGER,
    CONSTRAINT "Expense_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Expense_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_voidedBy_fkey" FOREIGN KEY ("voidedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("amount", "category", "id") SELECT "amount", "category", "id" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_shiftId_idx" ON "Expense"("shiftId");
CREATE INDEX "Expense_createdAt_idx" ON "Expense"("createdAt");
CREATE INDEX "Expense_isVoided_idx" ON "Expense"("isVoided");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
