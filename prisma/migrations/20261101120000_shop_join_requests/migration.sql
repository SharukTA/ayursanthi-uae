-- Public requests to join the My Shop programme. One new table and one new enum,
-- with no change to any existing table.

-- CreateEnum
CREATE TYPE "ShopRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "ShopRequest" (
    "id" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "investmentAed" DECIMAL(10,2) NOT NULL,
    "status" "ShopRequestStatus" NOT NULL DEFAULT 'PENDING',
    "shopId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopRequest_shopId_key" ON "ShopRequest"("shopId");

-- CreateIndex
CREATE INDEX "ShopRequest_status_createdAt_idx" ON "ShopRequest"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ShopRequest" ADD CONSTRAINT "ShopRequest_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
