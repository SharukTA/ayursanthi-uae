-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "courierName" TEXT,
ADD COLUMN     "trackingNumber" TEXT;

-- NOTE: prisma migrate also emitted
--   ALTER TABLE "Product" ALTER COLUMN "searchVector" DROP DEFAULT;
-- which has been removed deliberately. searchVector is a GENERATED ALWAYS AS
-- ... STORED column (see 20260621120000_add_product_search) that Prisma models
-- as Unsupported("tsvector") and therefore misreads as a plain column with a
-- default. Postgres rejects DROP DEFAULT on a generated column, so leaving the
-- line in would fail the migration. Expect it to reappear in future diffs.

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "EmailStatus" NOT NULL,
    "error" TEXT,
    "orderId" TEXT,
    "returnId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailLog_createdAt_idx" ON "EmailLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_orderId_idx" ON "EmailLog"("orderId");

-- CreateIndex
CREATE INDEX "EmailLog_status_createdAt_idx" ON "EmailLog"("status", "createdAt");
