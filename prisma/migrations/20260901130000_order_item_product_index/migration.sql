-- Index OrderItem by product.
--
-- The "Continue shopping" strip now hides products the shopper has already
-- bought, which means every load of it asks "is any of these twenty products in
-- one of this shopper's orders?". Without this index that question is answered
-- by scanning every line item the store has ever sold, and it gets slower with
-- each order taken.
--
-- Purely additive: an index, no data touched.
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
