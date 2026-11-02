-- Open card disputes on shop sales, and the contact details an owner used to have. Only
-- adds columns, and nothing already stored changes.

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "formerEmails" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "formerPhones" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ShopSale" ADD COLUMN     "disputeEventAt" TIMESTAMP(3),
ADD COLUMN     "disputedAt" TIMESTAMP(3);
