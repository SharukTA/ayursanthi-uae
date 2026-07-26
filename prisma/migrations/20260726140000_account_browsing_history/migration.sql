-- Account-side browsing history (Amazon model): a signed-in shopper's viewed
-- products follow them across devices, and they can view/remove them or turn
-- recording off entirely from the Browsing History page.
--
-- Signed-out browsing is not stored server-side at all; it lives in the
-- visitor's browser and is folded into the account on sign-in.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "browsingHistoryEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "ProductView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductView_pkey" PRIMARY KEY ("id")
);

-- One row per user per product: a repeat view bumps viewedAt rather than
-- appending, so the history is inherently de-duplicated.
-- CreateIndex
CREATE UNIQUE INDEX "ProductView_userId_productId_key" ON "ProductView"("userId", "productId");

-- Serves the only read pattern there is: newest-first for one user.
-- CreateIndex
CREATE INDEX "ProductView_userId_viewedAt_idx" ON "ProductView"("userId", "viewedAt");

-- Cascades both ways: closing an account erases its history, and deleting a
-- product removes it from everyone's.
-- AddForeignKey
ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductView" ADD CONSTRAINT "ProductView_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
