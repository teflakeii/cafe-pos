CREATE UNIQUE INDEX one_active_order_per_table
ON "Order" ("tableId")
WHERE status IN ('OPEN', 'SETTLING');
