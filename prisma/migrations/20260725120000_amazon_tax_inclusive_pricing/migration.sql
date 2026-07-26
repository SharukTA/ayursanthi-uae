-- Amazon-style GST-inclusive pricing + per-product delivery fees.
--
-- Prices are now interpreted as GST-INCLUSIVE (the price the shopper sees is the
-- price they pay for the goods). The new Product.gstRate only splits the tax
-- already inside the price for the invoice; it never adds money on top.
-- Product.shippingFee is a per-product delivery charge, summed per order and
-- waived above the free-shipping threshold (see lib/pricing.js).
--
-- OrderItem captures the GST slab and the tax embedded in each line at purchase
-- time, so an invoice or a refund stays exact even if a product's rate later
-- changes. Existing rows default to 0% / 0.00, which is why the order and refund
-- views detect any pre-existing "tax added on top" orders and render them the
-- old way (lib/pricing.js orderChargesTaxOnTop).

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gstRate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shippingFee" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "gstRate" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tax" DECIMAL(10,2) NOT NULL DEFAULT 0;
