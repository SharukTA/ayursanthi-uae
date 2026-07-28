-- Adds the OUT_FOR_DELIVERY rung between SHIPPED and DELIVERED.
--
-- BEFORE 'DELIVERED' is deliberate: Postgres sorts an enum by the physical order
-- of its labels, so appending would have placed OUT_FOR_DELIVERY after CANCELLED
-- and any future `ORDER BY status` would have read out of lifecycle order.
--
-- Postgres 12+ permits ALTER TYPE ... ADD VALUE inside a transaction block (which
-- is how Prisma runs migrations) as long as the new value is not *used* in that
-- same transaction. This migration only declares it, so it is safe.
ALTER TYPE "OrderStatus" ADD VALUE 'OUT_FOR_DELIVERY' BEFORE 'DELIVERED';

-- NOTE: prisma migrate also emits
--   ALTER TABLE "Product" ALTER COLUMN "searchVector" DROP DEFAULT;
-- on every diff, which is removed here deliberately. searchVector is a
-- GENERATED ALWAYS AS ... STORED column (see 20260621120000_add_product_search)
-- that Prisma models as Unsupported("tsvector") and therefore misreads as a
-- plain column with a default. Postgres rejects DROP DEFAULT on a generated
-- column, so leaving the line in would fail the migration.
