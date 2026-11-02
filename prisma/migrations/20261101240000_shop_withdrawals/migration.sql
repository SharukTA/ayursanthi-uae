-- Withdrawal requests from shop owners. One new table and one new enum, with no change
-- to any existing table.

-- CreateEnum
CREATE TYPE "ShopWithdrawalStatus" AS ENUM ('PENDING', 'PAID', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ShopWithdrawal" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "ShopWithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "payoutId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopWithdrawal_payoutId_key" ON "ShopWithdrawal"("payoutId");

-- CreateIndex
CREATE INDEX "ShopWithdrawal_shopId_createdAt_idx" ON "ShopWithdrawal"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopWithdrawal_status_createdAt_idx" ON "ShopWithdrawal"("status", "createdAt");

-- One request waiting per shop, so two taps cannot ask for the same money twice. Written
-- by hand because Prisma's schema cannot express a partial index.
CREATE UNIQUE INDEX "ShopWithdrawal_one_pending_per_shop" ON "ShopWithdrawal"("shopId") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "ShopWithdrawal" ADD CONSTRAINT "ShopWithdrawal_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopWithdrawal" ADD CONSTRAINT "ShopWithdrawal_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "ShopPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
