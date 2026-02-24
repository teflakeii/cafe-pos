-- CreateTable
CREATE TABLE "TablePerson" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" DATETIME,
    CONSTRAINT "TablePerson_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CafeTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TablePerson_tableId_idx" ON "TablePerson"("tableId");
