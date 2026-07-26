-- Adds the Amazon-style cancel + return/replace flows.
--
--  * Order gains the cancellation trail (who/when/why), the delivery timestamp
--    that starts the return window, and a running refunded total.
--  * ReturnRequest / ReturnItem hold a customer's request to send item(s) back,
--    down to a per-line quantity, with its own lifecycle.
--
-- Refunds themselves are not a new table: they are Payment rows with
-- provider = 'refund' and status = 'REFUNDED', so the money ledger stays in one
-- place.

-- CreateEnum
CREATE TYPE "CancelledBy" AS ENUM ('CUSTOMER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ReturnStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PICKED_UP', 'RECEIVED', 'REFUNDED', 'REPLACED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReturnResolution" AS ENUM ('REFUND', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "ReturnReason" AS ENUM ('DAMAGED', 'DEFECTIVE', 'WRONG_ITEM', 'MISSING_PARTS', 'NOT_AS_DESCRIBED', 'NO_LONGER_NEEDED', 'BOUGHT_BY_MISTAKE', 'BETTER_PRICE', 'OTHER');

-- CreateEnum
CREATE TYPE "RefundMethod" AS ENUM ('BANK_TRANSFER', 'CASH_ON_PICKUP');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancelReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledBy" "CancelledBy",
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "refundedTotal" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Backfill: orders already delivered have no recorded delivery time, so fall
-- back to the last time they were touched (which, for a DELIVERED order, is the
-- admin marking it delivered). Without this every historical order would look
-- like its return window never opened.
UPDATE "Order" SET "deliveredAt" = "updatedAt" WHERE "status" = 'DELIVERED';

-- Same idea for cancellations that predate this migration.
UPDATE "Order" SET "cancelledAt" = "updatedAt", "cancelledBy" = 'ADMIN' WHERE "status" = 'CANCELLED';

-- CreateTable
CREATE TABLE "ReturnRequest" (
    "id" TEXT NOT NULL,
    "returnNumber" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReturnStatus" NOT NULL DEFAULT 'REQUESTED',
    "resolution" "ReturnResolution" NOT NULL DEFAULT 'REFUND',
    "reason" "ReturnReason" NOT NULL,
    "comment" TEXT,
    "refundAmount" DECIMAL(10,2) NOT NULL,
    "refundMethod" "RefundMethod",
    "refundDetails" JSONB,
    "refundReference" TEXT,
    "adminNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "pickedUpAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReturnRequest_returnNumber_key" ON "ReturnRequest"("returnNumber");

-- CreateIndex
CREATE INDEX "ReturnRequest_userId_requestedAt_idx" ON "ReturnRequest"("userId", "requestedAt");

-- CreateIndex
CREATE INDEX "ReturnRequest_orderId_idx" ON "ReturnRequest"("orderId");

-- CreateIndex
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");

-- CreateIndex
CREATE INDEX "ReturnItem_returnId_idx" ON "ReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ReturnItem_orderItemId_idx" ON "ReturnItem"("orderItemId");

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnRequest" ADD CONSTRAINT "ReturnRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
