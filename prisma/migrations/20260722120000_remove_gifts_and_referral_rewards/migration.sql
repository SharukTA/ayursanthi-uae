-- Removes the gift-draw program and the whole referral/affiliate reward system
-- (commission, wallet, payouts, withdrawals, vouchers, company earnings), leaving
-- a plain storefront: browse, cart, checkout, orders.

-- AlterEnum
-- The AFFILIATE role no longer exists; fold any remaining ones into CUSTOMER
-- first, otherwise the cast below would fail on those rows.
UPDATE "User" SET "role" = 'CUSTOMER' WHERE "role" = 'AFFILIATE';

BEGIN;
CREATE TYPE "UserRole_new" AS ENUM ('CUSTOMER', 'ADMIN');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole_new" USING ("role"::text::"UserRole_new");
ALTER TYPE "UserRole" RENAME TO "UserRole_old";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';
COMMIT;

-- DropForeignKey
ALTER TABLE "CompanyEarning" DROP CONSTRAINT "CompanyEarning_referrerId_fkey";

-- DropForeignKey
ALTER TABLE "GiftTierItem" DROP CONSTRAINT "GiftTierItem_tierId_fkey";

-- DropForeignKey
ALTER TABLE "GiftWin" DROP CONSTRAINT "GiftWin_tierId_fkey";

-- DropForeignKey
ALTER TABLE "GiftWin" DROP CONSTRAINT "GiftWin_tierItemId_fkey";

-- DropForeignKey
ALTER TABLE "GiftWin" DROP CONSTRAINT "GiftWin_userId_fkey";

-- DropForeignKey
ALTER TABLE "PayoutAccount" DROP CONSTRAINT "PayoutAccount_userId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralReward" DROP CONSTRAINT "ReferralReward_productId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralReward" DROP CONSTRAINT "ReferralReward_userId_fkey";

-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_referredById_fkey";

-- DropForeignKey
ALTER TABLE "VoucherRedemption" DROP CONSTRAINT "VoucherRedemption_userId_fkey";

-- DropForeignKey
ALTER TABLE "VoucherRedemption" DROP CONSTRAINT "VoucherRedemption_voucherId_fkey";

-- DropForeignKey
ALTER TABLE "Wallet" DROP CONSTRAINT "Wallet_userId_fkey";

-- DropForeignKey
ALTER TABLE "WalletTransaction" DROP CONSTRAINT "WalletTransaction_walletId_fkey";

-- DropForeignKey
ALTER TABLE "WithdrawalRequest" DROP CONSTRAINT "WithdrawalRequest_userId_fkey";

-- DropIndex
DROP INDEX "User_referralCode_key";

-- DropIndex
DROP INDEX "User_referredById_idx";

-- AlterTable
-- (searchVector is a GENERATED ALWAYS tsvector column and is left untouched.)
ALTER TABLE "Product" DROP COLUMN "isReferralReward";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "referralCode",
DROP COLUMN "referralMilestoneAt",
DROP COLUMN "referredById";

-- DropTable
DROP TABLE "CompanyEarning";

-- DropTable
DROP TABLE "GiftTier";

-- DropTable
DROP TABLE "GiftTierItem";

-- DropTable
DROP TABLE "GiftWin";

-- DropTable
DROP TABLE "PayoutAccount";

-- DropTable
DROP TABLE "ReferralReward";

-- DropTable
DROP TABLE "Voucher";

-- DropTable
DROP TABLE "VoucherRedemption";

-- DropTable
DROP TABLE "Wallet";

-- DropTable
DROP TABLE "WalletTransaction";

-- DropTable
DROP TABLE "WithdrawalRequest";

-- DropEnum
DROP TYPE "CompanyEarningType";

-- DropEnum
DROP TYPE "GiftWinStatus";

-- DropEnum
DROP TYPE "WalletTransactionType";

-- DropEnum
DROP TYPE "WithdrawalStatus";

-- CreateTable
CREATE TABLE "PasswordResetOtp" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordResetOtp_userId_idx" ON "PasswordResetOtp"("userId");

-- AddForeignKey
ALTER TABLE "PasswordResetOtp" ADD CONSTRAINT "PasswordResetOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

