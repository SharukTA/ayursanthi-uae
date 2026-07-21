-- CreateEnum
CREATE TYPE "CompanyEarningType" AS ENUM ('PRE_MILESTONE_REFERRAL_COMMISSION');

-- AlterEnum
ALTER TYPE "WithdrawalStatus" ADD VALUE 'PROCESSING';

-- AlterTable
-- (searchVector is a GENERATED column; the diff engine emits a spurious
--  `ALTER COLUMN "searchVector" DROP DEFAULT` for it because the type is Unsupported.
--  Dropped here — it has no default to drop.)
ALTER TABLE "Product" ADD COLUMN     "isReferralReward" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralMilestoneAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "WithdrawalRequest" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "isAuto" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "providerPayoutId" TEXT;

-- CreateTable
CREATE TABLE "PayoutAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "upiId" TEXT,
    "accountName" TEXT,
    "accountNumber" TEXT,
    "ifsc" TEXT,
    "rzpContactId" TEXT,
    "rzpFundAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyEarning" (
    "id" TEXT NOT NULL,
    "type" "CompanyEarningType" NOT NULL DEFAULT 'PRE_MILESTONE_REFERRAL_COMMISSION',
    "amount" DECIMAL(10,2) NOT NULL,
    "referrerId" TEXT,
    "buyerId" TEXT,
    "buyerName" TEXT,
    "orderId" TEXT,
    "orderNumber" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyEarning_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productImageUrl" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "GiftWinStatus" NOT NULL DEFAULT 'WON',
    "addressSnapshot" JSONB,
    "adminNote" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAccount_userId_key" ON "PayoutAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyEarning_orderId_key" ON "CompanyEarning"("orderId");

-- CreateIndex
CREATE INDEX "CompanyEarning_referrerId_createdAt_idx" ON "CompanyEarning"("referrerId", "createdAt");

-- CreateIndex
CREATE INDEX "CompanyEarning_createdAt_idx" ON "CompanyEarning"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_userId_key" ON "ReferralReward"("userId");

-- CreateIndex
CREATE INDEX "ReferralReward_status_createdAt_idx" ON "ReferralReward"("status", "createdAt");

-- CreateIndex
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalRequest_providerPayoutId_key" ON "WithdrawalRequest"("providerPayoutId");

-- AddForeignKey
ALTER TABLE "PayoutAccount" ADD CONSTRAINT "PayoutAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyEarning" ADD CONSTRAINT "CompanyEarning_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
