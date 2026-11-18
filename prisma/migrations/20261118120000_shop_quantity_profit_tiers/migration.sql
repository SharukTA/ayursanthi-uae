-- Profit now follows the units a shop has sold (SHOP_PROFIT_TIERS in lib/shop-shared.js)
-- and joining costs nothing, so the investment amounts, the per-shop rate and the owners'
-- requests to change their investment all go. Every past sale keeps the rate it was made
-- at, which lives on ShopSale and is untouched here.

-- DropTable (its partial unique index and foreign key go with it)
DROP TABLE "ShopInvestmentChange";

-- DropEnum
DROP TYPE "ShopInvestmentChangeStatus";

-- AlterTable
ALTER TABLE "Shop" DROP COLUMN "investmentAed",
DROP COLUMN "commissionRate";

-- AlterTable
ALTER TABLE "ShopRequest" DROP COLUMN "investmentAed";
