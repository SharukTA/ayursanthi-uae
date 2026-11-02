-- Shop referrals: a partner's referral code, who referred whom, and the referrer's
-- share of each sale. Only adds columns to the My Shop tables and changes no existing
-- value. Shops that already exist get a referral code here and have no referrer.

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredByShopId" TEXT;

-- Backfill. Same look as the codes the app mints in lib/shop.js: capitals and digits
-- with 0 and 1 swapped out, because these get read out over the phone.
UPDATE "Shop"
SET "referralCode" = TRANSLATE(UPPER(SUBSTR(MD5(RANDOM()::TEXT || "id"), 1, 10)), '01', 'GH');

-- AlterTable
ALTER TABLE "Shop" ALTER COLUMN "referralCode" SET NOT NULL;

-- AlterTable
ALTER TABLE "ShopRequest" ADD COLUMN     "referrerShopId" TEXT;

-- AlterTable
ALTER TABLE "ShopSale" ADD COLUMN     "referrerCommission" DECIMAL(10,2),
ADD COLUMN     "referrerRate" DECIMAL(5,2),
ADD COLUMN     "referrerShopId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Shop_referralCode_key" ON "Shop"("referralCode");

-- CreateIndex
CREATE INDEX "Shop_referredByShopId_createdAt_idx" ON "Shop"("referredByShopId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopRequest_referrerShopId_idx" ON "ShopRequest"("referrerShopId");

-- CreateIndex
CREATE INDEX "ShopSale_referrerShopId_createdAt_idx" ON "ShopSale"("referrerShopId", "createdAt");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_referredByShopId_fkey" FOREIGN KEY ("referredByShopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopRequest" ADD CONSTRAINT "ShopRequest_referrerShopId_fkey" FOREIGN KEY ("referrerShopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSale" ADD CONSTRAINT "ShopSale_referrerShopId_fkey" FOREIGN KEY ("referrerShopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
