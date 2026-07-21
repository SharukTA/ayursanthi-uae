-- CreateEnum
CREATE TYPE "PrizeClaimStatus" AS ENUM ('ASSIGNED', 'CLAIMED', 'SHIPPED', 'REJECTED');

-- CreateTable
CREATE TABLE "GiftPrize" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    "referralTarget" INTEGER NOT NULL DEFAULT 10,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrizeAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "prizeId" TEXT,
    "status" "PrizeClaimStatus" NOT NULL DEFAULT 'ASSIGNED',
    "prizeName" TEXT NOT NULL,
    "prizeImageUrl" TEXT,
    "referralTarget" INTEGER NOT NULL,
    "addressSnapshot" JSONB,
    "adminNote" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrizeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GiftPrize_isActive_sortOrder_idx" ON "GiftPrize"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PrizeAssignment_userId_key" ON "PrizeAssignment"("userId");

-- CreateIndex
CREATE INDEX "PrizeAssignment_status_createdAt_idx" ON "PrizeAssignment"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PrizeAssignment" ADD CONSTRAINT "PrizeAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrizeAssignment" ADD CONSTRAINT "PrizeAssignment_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "GiftPrize"("id") ON DELETE SET NULL ON UPDATE CASCADE;
