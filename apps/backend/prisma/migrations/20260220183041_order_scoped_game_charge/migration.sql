-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GameSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "tableId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "startedAt" DATETIME NOT NULL,
    "endedAt" DATETIME,
    CONSTRAINT "GameSession_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "CafeTable" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GameSession_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GameSession" ("endedAt", "id", "orderId", "startedAt", "tableId")
SELECT
    gs."endedAt",
    gs."id",
    (
        SELECT o."id"
        FROM "Order" o
        WHERE o."tableId" = gs."tableId"
          AND o."openedAt" <= gs."startedAt"
          AND (o."closedAt" IS NULL OR o."closedAt" >= COALESCE(gs."endedAt", gs."startedAt"))
        ORDER BY o."openedAt" DESC
        LIMIT 1
    ) AS "orderId",
    gs."startedAt",
    gs."tableId"
FROM "GameSession" gs;
DROP TABLE "GameSession";
ALTER TABLE "new_GameSession" RENAME TO "GameSession";
CREATE INDEX "GameSession_tableId_idx" ON "GameSession"("tableId");
CREATE INDEX "GameSession_orderId_idx" ON "GameSession"("orderId");

CREATE TABLE "new_GameCharge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gameSessionId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "personId" INTEGER NOT NULL,
    "minutes" INTEGER NOT NULL,
    "ratePerHour" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "discountPercent" INTEGER NOT NULL,
    "finalPrice" INTEGER NOT NULL,
    CONSTRAINT "GameCharge_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GameCharge_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GameCharge_personId_fkey" FOREIGN KEY ("personId") REFERENCES "TablePerson" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GameCharge" ("discountPercent", "finalPrice", "gameSessionId", "id", "minutes", "orderId", "personId", "price", "ratePerHour")
SELECT
    gc."discountPercent",
    gc."finalPrice",
    gc."gameSessionId",
    gc."id",
    gc."minutes",
    COALESCE(
      ngs."orderId",
      (
          SELECT o2."id"
          FROM "Order" o2
          WHERE o2."tableId" = ngs."tableId"
          ORDER BY o2."openedAt" DESC
          LIMIT 1
      )
    ) AS "orderId",
    gc."personId",
    gc."price",
    gc."ratePerHour"
FROM "GameCharge" gc
JOIN "GameSession" ngs
  ON ngs."id" = gc."gameSessionId";
DROP TABLE "GameCharge";
ALTER TABLE "new_GameCharge" RENAME TO "GameCharge";
CREATE INDEX "GameCharge_gameSessionId_idx" ON "GameCharge"("gameSessionId");
CREATE INDEX "GameCharge_orderId_idx" ON "GameCharge"("orderId");
CREATE INDEX "GameCharge_personId_idx" ON "GameCharge"("personId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
