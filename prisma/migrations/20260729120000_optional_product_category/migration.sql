-- Makes a product's category optional.
--
-- Two changes, both required for "category is optional everywhere":
--
--   1. Product.categoryId becomes nullable, so a product can be created (and
--      listed, searched, sold) without ever picking a category.
--
--   2. The foreign key switches from ON DELETE RESTRICT to ON DELETE SET NULL.
--      Previously, deleting a category that still had products was refused by
--      the database, which is why /admin/categories could only ever *disable* a
--      category. Now the delete succeeds and every product that pointed at it
--      is left uncategorized instead of orphaned or blocked.
--
-- Existing rows are untouched: they all have a category and keep it.

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "categoryId" DROP NOT NULL;

-- DropForeignKey / AddForeignKey (RESTRICT -> SET NULL)
ALTER TABLE "Product" DROP CONSTRAINT IF EXISTS "Product_categoryId_fkey";

ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
