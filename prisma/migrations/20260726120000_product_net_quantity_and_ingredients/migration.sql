-- Pack size + key ingredients as first-class product fields.
--
-- netQuantity is the shopper-facing pack size ("250 g", "60 capsules"). It is
-- deliberately NOT inventory: Product.stock stays a count of whole sellable
-- packs, because every quantity in the system (cart, order, return, restock)
-- decrements in units.
--
-- keyIngredients is a comma-separated headline list rendered as its own section
-- on the product page, and folded into the full-text vector at weight A so an
-- ingredient query ("brahmi") surfaces products that don't name it in the title.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "netQuantity" TEXT;
ALTER TABLE "Product" ADD COLUMN "keyIngredients" TEXT;

-- A GENERATED ALWAYS column's expression cannot be altered in place, so the
-- vector and its index are dropped and rebuilt with keyIngredients added.
-- Postgres recomputes every row on ADD COLUMN, so existing products are
-- backfilled automatically — no data migration step is needed.
DROP INDEX IF EXISTS "Product_searchVector_idx";
ALTER TABLE "Product" DROP COLUMN "searchVector";

ALTER TABLE "Product" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("searchKeywords", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("keyIngredients", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("shortDescription", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  ) STORED;

-- CreateIndex
CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");
