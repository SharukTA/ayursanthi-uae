-- A shop owner's waiting email change: the new address and the one-time code sent to
-- it. One new table, with no change to any existing one.

-- CreateTable
CREATE TABLE "ShopEmailChange" (
    "shopId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopEmailChange_pkey" PRIMARY KEY ("shopId")
);

-- AddForeignKey
ALTER TABLE "ShopEmailChange" ADD CONSTRAINT "ShopEmailChange_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;
