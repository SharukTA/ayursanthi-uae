-- Multiple photographs per gift prize.
--
-- The headline prizes are the reason anybody reads the gifts page, and one
-- photograph rarely sells a car or a villa — the store wants the exterior, the
-- interior and the detail shot. So GiftPrize.imageUrl becomes an ordered table:
-- the row with the lowest sortOrder is the cover every card and email shows, and
-- the rest are extra angles for the pages that can display a gallery. Which one
-- is the cover is therefore an admin decision, not something the database picks.
--
-- Not additive: the old column is dropped. It is backfilled first, in the same
-- transaction, so every prize that had a picture keeps it as its cover and no
-- artwork is lost. Prizes that never had one simply start with an empty gallery,
-- exactly as they started with a null column.
CREATE TABLE "GiftPrizeImage" (
    "id" TEXT NOT NULL,
    "prizeId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftPrizeImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "GiftPrizeImage_prizeId_sortOrder_idx" ON "GiftPrizeImage"("prizeId", "sortOrder");

ALTER TABLE "GiftPrizeImage" ADD CONSTRAINT "GiftPrizeImage_prizeId_fkey"
    FOREIGN KEY ("prizeId") REFERENCES "GiftPrize"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill BEFORE the drop. gen_random_uuid() is available without an extension
-- on PostgreSQL 13+; the id only has to be unique, and nothing parses it.
INSERT INTO "GiftPrizeImage" ("id", "prizeId", "url", "sortOrder")
SELECT gen_random_uuid()::text, "id", "imageUrl", 0
FROM "GiftPrize"
WHERE "imageUrl" IS NOT NULL AND "imageUrl" <> '';

ALTER TABLE "GiftPrize" DROP COLUMN "imageUrl";
