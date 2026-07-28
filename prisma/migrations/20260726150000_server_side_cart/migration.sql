-- Server-side cart (Amazon model): a signed-in shopper's cart lives on their
-- account, so it follows them to any device or browser. The CartItem table has
-- existed since the initial schema but was never written to — the cart lived
-- entirely in the visitor's localStorage. It is now the source of truth for
-- signed-in shoppers; signed-out visitors keep a browser cart that is merged
-- into the account on sign-in (see mergeGuestCart in src/lib/cart.js).
--
-- Only the per-line checkbox is new. Quantity was already stored, and price /
-- GST / delivery are deliberately NOT stored here: they are read from Product
-- on every request so a saved cart can never serve a stale price.

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN "selected" BOOLEAN NOT NULL DEFAULT true;

-- Serves the only read pattern there is: every line of one shopper's cart,
-- oldest first. Without it, each cart render is a sequential scan.
-- CreateIndex
CREATE INDEX "CartItem_userId_createdAt_idx" ON "CartItem"("userId", "createdAt");
