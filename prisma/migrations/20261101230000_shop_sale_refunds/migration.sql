-- What a refund made in Stripe's dashboard takes back from a shop sale. Only adds
-- columns, all defaulting to "nothing refunded", so existing sales read exactly as
-- they did. Refunds made before this are not picked up.

-- AlterTable
ALTER TABLE "ShopSale" ADD COLUMN     "refundedGoods" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "refundedInFull" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reversedCommission" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "reversedReferrerCommission" DECIMAL(10,2) NOT NULL DEFAULT 0;
