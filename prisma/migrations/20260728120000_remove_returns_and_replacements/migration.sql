-- Removes the return / replacement program entirely. The store does not accept
-- returns or replacements: an order can be cancelled before it ships, and that
-- is the only path that puts money back.
--
-- Order.refundedTotal, PaymentStatus.REFUNDED and the "refund" Payment rows all
-- stay — they now record cancellation refunds only.

-- DropForeignKey
ALTER TABLE "ReturnItem" DROP CONSTRAINT "ReturnItem_orderItemId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnItem" DROP CONSTRAINT "ReturnItem_returnId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnRequest" DROP CONSTRAINT "ReturnRequest_orderId_fkey";

-- DropForeignKey
ALTER TABLE "ReturnRequest" DROP CONSTRAINT "ReturnRequest_userId_fkey";

-- DropTable
DROP TABLE "ReturnItem";

-- DropTable
DROP TABLE "ReturnRequest";

-- DropEnum
DROP TYPE "ReturnStatus";

-- DropEnum
DROP TYPE "ReturnResolution";

-- DropEnum
DROP TYPE "ReturnReason";

-- DropEnum
DROP TYPE "RefundMethod";

-- AlterTable
-- The email audit trail no longer has returns to point at. Rows describing a
-- past return email keep their subject/template; only the dangling id goes.
ALTER TABLE "EmailLog" DROP COLUMN "returnId";
