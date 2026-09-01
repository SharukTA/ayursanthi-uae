-- The instant a draw stops accepting qualifying purchases.
--
-- Until now a draw counted every purchase right up to the moment it was held,
-- which let a coupon enter the drum while the order behind it was still inside
-- its cancellation window. The customer could win, be told, and then cancel for
-- a full refund and keep the prize — the win survived because nothing re-reads
-- the coupon after the winners are created.
--
-- The cutoff is the fix: entries close one cancellation window BEFORE the draw,
-- so a ticket can only be in the drum once the order that earned it can no
-- longer be pulled back by anybody. Stored rather than recomputed for the same
-- reason cycleStart and cycleEnd are — a draw has to be able to explain its own
-- entry list afterwards, and recomputing from a setting that has since moved
-- would retroactively redefine who was eligible for a result already published.
--
-- Backfilled to cycleEnd, which IS the old rule written down: every existing
-- draw counted purchases right up to its own instant, and its frozen entry list
-- must keep reading exactly the way it behaved. Draws still SCHEDULED are
-- rewritten with a real cutoff by the next ensureDraw() or freezeDraw().
ALTER TABLE "GiftDraw" ADD COLUMN "entryCutoff" TIMESTAMP(3);

UPDATE "GiftDraw" SET "entryCutoff" = "cycleEnd" WHERE "entryCutoff" IS NULL;

ALTER TABLE "GiftDraw" ALTER COLUMN "entryCutoff" SET NOT NULL;
