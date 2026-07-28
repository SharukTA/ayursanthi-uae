-- Removes the last of the tax machinery.
--
-- Prices are tax-inclusive and final: the amount shown on a card is the amount
-- charged for the goods, and nothing is added or broken out on top of it. See
-- lib/pricing.js.
--
-- These four columns are what remained of the old GST-slab / UAE-VAT split.
-- prisma/schema.prisma already stopped declaring them, so the application has
-- neither read nor written them for some time — this closes the resulting drift
-- so `prisma migrate` stops proposing the drop on every run.
--
-- Order.subtotal / shipping / total are deliberately untouched: they already
-- record the full amount the customer was charged, so historical orders and the
-- invoices rendered from them are unaffected. What is lost is only the *split*
-- of tax out of that total on pre-2026-07 orders, which nothing has rendered
-- since the store moved to inclusive pricing.
--
-- IF EXISTS because environments have drifted apart: a database rebuilt from
-- these migrations still has the columns, while one last synced with
-- `prisma db push` against the current schema does not.

-- AlterTable
ALTER TABLE "Product" DROP COLUMN IF EXISTS "gstRate";

-- AlterTable
ALTER TABLE "OrderItem" DROP COLUMN IF EXISTS "gstRate",
DROP COLUMN IF EXISTS "tax";

-- AlterTable
ALTER TABLE "Order" DROP COLUMN IF EXISTS "tax";
