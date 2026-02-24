-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("id", "email", "password", "role", "isActive", "createdAt")
SELECT
    "id",
    LOWER(REPLACE(COALESCE(NULLIF(TRIM("fullName"), ''), 'user'), ' ', '.')) || '.' || "id" || '@legacy.local',
    '$2b$10$LJQ4yqNk8UuBMbyX3oT0uOfa3N2s.pNYLF6/e8Hym5cwRqg4JOQiG',
    CASE
        WHEN UPPER("role") = 'OWNER' THEN 'OWNER'
        WHEN UPPER("role") = 'MANAGER' THEN 'MANAGER'
        WHEN UPPER("role") = 'ACCOUNTANT' THEN 'ACCOUNTANT'
        WHEN LOWER("role") = 'admin' THEN 'OWNER'
        WHEN LOWER("role") = 'waiter' THEN 'CASHIER'
        WHEN LOWER("role") = 'cashier' THEN 'CASHIER'
        ELSE 'CASHIER'
    END,
    "isActive",
    "createdAt"
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
