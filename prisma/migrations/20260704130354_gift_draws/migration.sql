-- CreateEnum
CREATE TYPE "GiftWinStatus" AS ENUM ('WON', 'CLAIMED', 'SHIPPED', 'REJECTED');

-- DropForeignKey
ALTER TABLE "PrizeAssignment" DROP CONSTRAINT "PrizeAssignment_prizeId_fkey";

-- DropForeignKey
ALTER TABLE "PrizeAssignment" DROP CONSTRAINT "PrizeAssignment_userId_fkey";

-- DropTable
DROP TABLE "GiftPrize";

-- DropTable
DROP TABLE "PrizeAssignment";

-- DropEnum
DROP TYPE "PrizeClaimStatus";

-- CreateTable
CREATE TABLE "GiftTier" (
    "id" TEXT NOT NULL,
    "memberThreshold" INTEGER NOT NULL,
    "label" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "drawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftTierItem" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftTierItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftWin" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "tierItemId" TEXT,
    "userId" TEXT NOT NULL,
    "isReferrerMirror" BOOLEAN NOT NULL DEFAULT false,
    "relatedWinId" TEXT,
    "giftName" TEXT NOT NULL,
    "giftImageUrl" TEXT,
    "quantity" INTEGER NOT NULL,
    "status" "GiftWinStatus" NOT NULL DEFAULT 'WON',
    "addressSnapshot" JSONB,
    "adminNote" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftWin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GiftTier_isActive_sortOrder_idx" ON "GiftTier"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "GiftTierItem_tierId_sortOrder_idx" ON "GiftTierItem"("tierId", "sortOrder");

-- CreateIndex
CREATE INDEX "GiftWin_userId_createdAt_idx" ON "GiftWin"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GiftWin_status_createdAt_idx" ON "GiftWin"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "GiftTierItem" ADD CONSTRAINT "GiftTierItem_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "GiftTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftWin" ADD CONSTRAINT "GiftWin_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "GiftTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftWin" ADD CONSTRAINT "GiftWin_tierItemId_fkey" FOREIGN KEY ("tierItemId") REFERENCES "GiftTierItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftWin" ADD CONSTRAINT "GiftWin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

