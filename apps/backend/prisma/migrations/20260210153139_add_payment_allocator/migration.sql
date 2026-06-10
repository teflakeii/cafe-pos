/*
  Warnings:

  - Added the required column `payerPersonId` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CafeTable" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableNo" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'FREE'
);
INSERT INTO "new_CafeTable" ("id", "isActive", "tableNo") SELECT "id", "isActive", "tableNo" FROM "CafeTable";
DROP TABLE "CafeTable";
ALTER TABLE "new_CafeTable" RENAME TO "CafeTable";
CREATE UNIQUE INDEX "CafeTable_tableNo_key" ON "CafeTable"("tableNo");
CREATE TABLE "new_Payment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "orderId" INTEGER NOT NULL,
    "payerPersonId" INTEGER NOT NULL,
    "beneficiaryPersonId" INTEGER,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_payerPersonId_fkey" FOREIGN KEY ("payerPersonId") REFERENCES "TablePerson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Payment_beneficiaryPersonId_fkey" FOREIGN KEY ("beneficiaryPersonId") REFERENCES "TablePerson" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
DROP TABLE "Payment";
ALTER TABLE "new_Payment" RENAME TO "Payment";
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX "Payment_payerPersonId_idx" ON "Payment"("payerPersonId");
CREATE INDEX "Payment_beneficiaryPersonId_idx" ON "Payment"("beneficiaryPersonId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
