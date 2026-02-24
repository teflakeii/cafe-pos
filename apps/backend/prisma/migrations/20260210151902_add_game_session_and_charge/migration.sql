-- CreateTable
CREATE TABLE "GameSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableId" INTEGER NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    CONSTRAINT "GameSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CafeTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GameCharge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameSessionId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "ratePerHour" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "finalPrice" INTEGER NOT NULL,
    CONSTRAINT "GameCharge_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GameCharge_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TablePerson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GameSession_tableId_idx" ON "GameSession"("tableId");

-- CreateIndex
CREATE INDEX "GameCharge_gameSessionId_idx" ON "GameCharge"("gameSessionId");

-- CreateIndex
CREATE INDEX "GameCharge_personId_idx" ON "GameCharge"("personId");
