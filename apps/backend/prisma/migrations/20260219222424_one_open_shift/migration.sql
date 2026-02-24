CREATE UNIQUE INDEX one_open_shift
ON "Shift" ("status")
WHERE status = 'OPEN';
