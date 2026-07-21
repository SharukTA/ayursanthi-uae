-- CreateEnum
CREATE TYPE "SectionPlacement" AS ENUM ('HOME', 'PRODUCT', 'CATEGORY', 'CHECKOUT');

-- AlterTable
ALTER TABLE "HomeSection" ADD COLUMN "placement" "SectionPlacement" NOT NULL DEFAULT 'HOME';

-- CreateIndex
CREATE INDEX "HomeSection_placement_isActive_position_idx" ON "HomeSection"("placement", "isActive", "position");
