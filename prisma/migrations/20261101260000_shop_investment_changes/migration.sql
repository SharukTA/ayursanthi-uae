-- Owners asking to change their investment, for an admin to approve. One new table and
-- one new enum, with no change to any existing table.

-- CreateEnum
CREATE TYPE "ShopInvestmentChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ShopInvestmentChange" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "fromInvestmentAed" DECIMAL(10,2) NOT NULL,
    "toInvestmentAed" DECIMAL(10,2) NOT NULL,
    "status" "ShopInvestmentChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopInvestmentChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopInvestmentChange_shopId_createdAt_idx" ON "ShopInvestmentChange"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopInvestmentChange_status_createdAt_idx" ON "ShopInvestmentChange"("status", "createdAt");

-- One request waiting per shop. Written by hand because Prisma's schema cannot express a
-- partial index.
CREATE UNIQUE INDEX "ShopInvestmentChange_one_pending_per_shop" ON "ShopInvestmentChange"("shopId") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "ShopInvestmentChange" ADD CONSTRAINT "ShopInvestmentChange_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
