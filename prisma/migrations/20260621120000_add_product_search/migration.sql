-- Amazon-style search: a free-text keywords field plus a generated full-text
-- index column. searchVector is recomputed automatically by Postgres on every
-- INSERT/UPDATE, so application code only ever writes name/searchKeywords/etc.
-- Weights: name + searchKeywords = A (most important), shortDescription = B,
-- description = C. ts_rank uses these weights when ranking matches.

-- AlterTable: free-text search keywords (synonyms / benefits / ingredients).
ALTER TABLE "Product" ADD COLUMN "searchKeywords" TEXT;

-- AlterTable: generated full-text vector. STORED so it can back a GIN index.
ALTER TABLE "Product" ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("searchKeywords", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("shortDescription", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  ) STORED;

-- CreateIndex: GIN index makes @@ (full-text match) lookups fast.
CREATE INDEX "Product_searchVector_idx" ON "Product" USING GIN ("searchVector");
