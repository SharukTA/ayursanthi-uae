-- Two new auto-filled Content Builder blocks. Neither stores HomeSectionItem
-- rows: BEST_SELLERS is aggregated from paid OrderItems at render time, and
-- RECENTLY_VIEWED is assembled in the browser from the visitor's own history.
-- So this is an enum-only change — no new tables, no backfill.

-- AlterEnum
ALTER TYPE "HomeSectionType" ADD VALUE 'BEST_SELLERS';
ALTER TYPE "HomeSectionType" ADD VALUE 'RECENTLY_VIEWED';
