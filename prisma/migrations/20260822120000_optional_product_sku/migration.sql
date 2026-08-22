-- Makes a product's SKU optional.
--
-- The SKU is an admin-facing catalogue reference, not an identity: the cart,
-- order lines, the product page and the PDF all key off the product's id or
-- slug, so nothing breaks when it is absent. Dropping NOT NULL lets a listing
-- be created before the warehouse has assigned a code.
--
-- The UNIQUE index stays exactly as it was. In Postgres a unique index treats
-- NULLs as distinct, so any number of products may have no SKU while two
-- products still cannot share a real one.
--
-- Existing rows are untouched: they all have a SKU and keep it.

-- AlterTable
ALTER TABLE "Product" ALTER COLUMN "sku" DROP NOT NULL;
