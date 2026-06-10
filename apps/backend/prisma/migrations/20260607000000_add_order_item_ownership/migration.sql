-- AlterTable: add per-person ownership columns to OrderItem
-- Both columns are backward-compatible:
--   ownerType defaults to 'SHARED' so existing rows are unaffected
--   ownerPersonId is nullable so no data backfill is needed

ALTER TABLE "OrderItem" ADD COLUMN "ownerType" TEXT NOT NULL DEFAULT 'SHARED';
ALTER TABLE "OrderItem" ADD COLUMN "ownerPersonId" INTEGER;
