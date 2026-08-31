-- Gift draw programme.
--
-- Every whole 100 AED of goods in a paid order earns the buyer one gift coupon
-- (GiftCoupon), tied to their user id. Coupons never expire, but they only take
-- part in a draw if their owner bought something inside that draw's cycle: a
-- qualifying purchase stamps lastQualifiedAt on EVERY coupon the customer holds
-- and mints another one on top. So a regular shopper's entries accumulate while
-- a one-off shopper's single coupon goes dormant until they buy again.
--
-- A draw (GiftDraw) runs on the 5th of each month. Its entry list is frozen
-- into GiftDrawEntry first, an admin then picks winners from that frozen list,
-- and publishing is what makes them visible. Freezing is the part that matters
-- for trust: eligibility is derived from data that keeps moving, so without a
-- snapshot there would be no way to say afterwards who was actually in the draw.
--
-- When a winner was referred by another customer, that referrer is owed the
-- same prize. That obligation is stored as its own GiftDrawWinner row
-- (kind = REFERRER) rather than recomputed at display time, so it survives any
-- later change to the referral link and gets its own fulfilment status.
--
-- Entirely additive: eight new tables and three new enums, no changes to any
-- existing table and no backfill. Safe to apply to a live database — the
-- programme simply has no history until the first qualifying order clears.

-- CreateEnum
CREATE TYPE "GiftDrawStatus" AS ENUM ('SCHEDULED', 'FROZEN', 'DRAWN', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "GiftWinnerKind" AS ENUM ('PRIMARY', 'REFERRER');

-- CreateEnum
CREATE TYPE "GiftFulfilmentStatus" AS ENUM ('PENDING', 'NOTIFIED', 'CLAIMED', 'DELIVERED');

-- CreateTable
CREATE TABLE "GiftPrize" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "imageUrl" TEXT,
    "valueNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "GiftPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftTier" (
    "id" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "memberCount" INTEGER NOT NULL,
    "totalMembers" INTEGER,
    "targetDays" INTEGER,
    "totalValueNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "GiftTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftTierItem" (
    "id" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

CONSTRAINT "GiftTierItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCoupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceOrderId" TEXT NOT NULL,
    "lastQualifiedAt" TIMESTAMP(3) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

CONSTRAINT "GiftCoupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftDraw" (
    "id" TEXT NOT NULL,
    "cycleKey" TEXT NOT NULL,
    "drawDate" TIMESTAMP(3) NOT NULL,
    "status" "GiftDrawStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cycleStart" TIMESTAMP(3) NOT NULL,
    "cycleEnd" TIMESTAMP(3) NOT NULL,
    "frozenAt" TIMESTAMP(3),
    "entryCount" INTEGER NOT NULL DEFAULT 0,
    "oneWinPerCustomer" BOOLEAN NOT NULL DEFAULT true,
    "drawnAt" TIMESTAMP(3),
    "drawnById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "GiftDraw_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftDrawPrize" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

CONSTRAINT "GiftDrawPrize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftDrawEntry" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "couponCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,

CONSTRAINT "GiftDrawEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftDrawWinner" (
    "id" TEXT NOT NULL,
    "drawId" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "couponId" TEXT,
    "kind" "GiftWinnerKind" NOT NULL DEFAULT 'PRIMARY',
    "mirroredFromWinnerId" TEXT,
    "status" "GiftFulfilmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "GiftDrawWinner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftPrize_slug_key" ON "GiftPrize"("slug");

-- CreateIndex
CREATE INDEX "GiftPrize_isActive_sortOrder_idx" ON "GiftPrize"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "GiftTier_isActive_sortOrder_idx" ON "GiftTier"("isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "GiftTierItem_tierId_sortOrder_idx" ON "GiftTierItem"("tierId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "GiftTierItem_tierId_prizeId_key" ON "GiftTierItem"("tierId", "prizeId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCoupon_code_key" ON "GiftCoupon"("code");

-- CreateIndex
CREATE INDEX "GiftCoupon_userId_createdAt_idx" ON "GiftCoupon"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GiftCoupon_lastQualifiedAt_idx" ON "GiftCoupon"("lastQualifiedAt");

-- CreateIndex
CREATE INDEX "GiftCoupon_sourceOrderId_idx" ON "GiftCoupon"("sourceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftDraw_cycleKey_key" ON "GiftDraw"("cycleKey");

-- CreateIndex
CREATE INDEX "GiftDraw_status_drawDate_idx" ON "GiftDraw"("status", "drawDate");

-- CreateIndex
CREATE UNIQUE INDEX "GiftDrawPrize_drawId_prizeId_key" ON "GiftDrawPrize"("drawId", "prizeId");

-- CreateIndex
CREATE INDEX "GiftDrawEntry_drawId_userId_idx" ON "GiftDrawEntry"("drawId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftDrawEntry_drawId_couponId_key" ON "GiftDrawEntry"("drawId", "couponId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftDrawEntry_drawId_position_key" ON "GiftDrawEntry"("drawId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "GiftDrawWinner_mirroredFromWinnerId_key" ON "GiftDrawWinner"("mirroredFromWinnerId");

-- CreateIndex
CREATE INDEX "GiftDrawWinner_drawId_kind_idx" ON "GiftDrawWinner"("drawId", "kind");

-- CreateIndex
CREATE INDEX "GiftDrawWinner_userId_createdAt_idx" ON "GiftDrawWinner"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "GiftTierItem" ADD CONSTRAINT "GiftTierItem_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "GiftTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftTierItem" ADD CONSTRAINT "GiftTierItem_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "GiftPrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCoupon" ADD CONSTRAINT "GiftCoupon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCoupon" ADD CONSTRAINT "GiftCoupon_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftDraw" ADD CONSTRAINT "GiftDraw_drawnById_fkey" FOREIGN KEY ("drawnById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftDrawPrize" ADD CONSTRAINT "GiftDrawPrize_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "GiftDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftDrawPrize" ADD CONSTRAINT "GiftDrawPrize_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "GiftPrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftDrawEntry" ADD CONSTRAINT "GiftDrawEntry_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "GiftDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftDrawEntry" ADD CONSTRAINT "GiftDrawEntry_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "GiftCoupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftDrawWinner" ADD CONSTRAINT "GiftDrawWinner_drawId_fkey" FOREIGN KEY ("drawId") REFERENCES "GiftDraw"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftDrawWinner" ADD CONSTRAINT "GiftDrawWinner_prizeId_fkey" FOREIGN KEY ("prizeId") REFERENCES "GiftPrize"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftDrawWinner" ADD CONSTRAINT "GiftDrawWinner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftDrawWinner" ADD CONSTRAINT "GiftDrawWinner_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "GiftCoupon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftDrawWinner" ADD CONSTRAINT "GiftDrawWinner_mirroredFromWinnerId_fkey" FOREIGN KEY ("mirroredFromWinnerId") REFERENCES "GiftDrawWinner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
