-- Gift posters, and a draw scheduled by exact date.
--
-- Two changes to the same feature:
--
-- 1. GiftPoster holds the campaign artwork an admin uploads. The gifts page is
--    an advertisement, and what sells a giveaway is one designed image carrying
--    the prize, the spend needed and the draw date together. Storing the
--    finished poster rather than rebuilding it from fields makes a new campaign
--    an upload instead of a deploy.
--
-- 2. The draw moves from a monthly cadence (`gift_draw_day`, "held on the 5th")
--    to a single announced date (`gift_draw_date`, "31/12/2026"), because that
--    is what the poster promises and what an admin picks off a calendar. The
--    old setting row is dropped; the new one falls back to the default in
--    lib/settings.js until an admin saves a date, so nothing is left unset.
--
-- Additive apart from that one settings row: a new table, no changes to any
-- existing table, no backfill. Draws already on record keep the window stored
-- on their own row, so the change of schedule cannot rewrite a result that has
-- already been decided.

-- CreateTable
CREATE TABLE "GiftPoster" (
    "id" TEXT NOT NULL,
    "title" TEXT,
    "imageUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "placement" TEXT NOT NULL DEFAULT 'BOTH',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftPoster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GiftPoster_isActive_sortOrder_idx" ON "GiftPoster"("isActive", "sortOrder");

-- The day-of-month cadence no longer exists. Removed rather than left behind so
-- a stale "5" cannot reappear if the key is ever reused for something else.
DELETE FROM "SiteSetting" WHERE "key" = 'gift_draw_day';
