-- UAE VAT migration.
--
-- The store was built on Indian GST (slabs 0/5/12/18/28) and now sells in the
-- UAE, where VAT is a single standard rate of 5% with a narrow 0% band for
-- zero-rated and exempt supplies.
--
-- The columns keep their `gstRate` names: the Prisma schema maps them to
-- `vatRate` via @map, so the application reads VAT everywhere without a rename
-- against live data. See prisma/schema.prisma.

-- 1. New products default to the UAE standard rate. The old default of 0 would
--    silently declare ordinary goods as zero-rated.
ALTER TABLE "Product" ALTER COLUMN "gstRate" SET DEFAULT 5;
ALTER TABLE "OrderItem" ALTER COLUMN "gstRate" SET DEFAULT 5;

-- 2. Re-rate the catalogue. Every existing product moves to the 5% standard
--    rate, including rows currently at 0: under Indian GST 0 meant
--    "unclassified" (the old default), not a deliberate zero-rating, so leaving
--    them at 0 would under-declare VAT. An admin can set genuine zero-rated
--    items back to 0% in /admin/products afterwards.
UPDATE "Product" SET "gstRate" = 5;

-- 3. OrderItem is deliberately NOT re-rated. Each row records the rate actually
--    charged on that order; rewriting it would make historical invoices
--    disagree with what the customer paid. Old orders keep their Indian slabs
--    and render exactly as they were issued.
