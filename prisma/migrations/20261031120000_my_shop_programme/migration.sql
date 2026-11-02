-- My Shop partner programme.
--
-- Three new tables and no change to any existing one, so this is safe to apply
-- ahead of the code that uses it. Commission lives in ShopSale rather than in
-- columns on Order because customer-facing routes return whole Order rows.

-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "investmentAed" DECIMAL(10,2) NOT NULL,
    "commissionRate" DECIMAL(5,2) NOT NULL,
    "linkCode" TEXT NOT NULL,
    "accessCodeHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sessionsValidFrom" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSale" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rate" DECIMAL(5,2) NOT NULL,
    "goodsTotal" DECIMAL(10,2) NOT NULL,
    "commission" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPayout" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopPayout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_linkCode_key" ON "Shop"("linkCode");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_accessCodeHash_key" ON "Shop"("accessCodeHash");

-- CreateIndex
CREATE UNIQUE INDEX "ShopSale_orderId_key" ON "ShopSale"("orderId");

-- CreateIndex
CREATE INDEX "ShopSale_shopId_createdAt_idx" ON "ShopSale"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "ShopPayout_shopId_createdAt_idx" ON "ShopPayout"("shopId", "createdAt");

-- AddForeignKey
ALTER TABLE "ShopSale" ADD CONSTRAINT "ShopSale_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopSale" ADD CONSTRAINT "ShopSale_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPayout" ADD CONSTRAINT "ShopPayout_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
