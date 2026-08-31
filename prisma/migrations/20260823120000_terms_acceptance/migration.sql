-- Record of acceptance of the conditions of use.
--
-- Acceptance is the signup click and the place-order click themselves: both
-- forms carry the notice immediately next to the button (components/
-- TermsNotice.js), there is no tickbox. These columns are what turns that into
-- evidence — which revision of /terms was live at the moment, so a dispute can
-- be answered with the text the customer actually saw rather than with whatever
-- the admin-editable page says today.
--
-- The version string is Page("terms").updatedAt as an ISO timestamp, or the
-- literal 'builtin-2026-05-24' while no active Page row exists and /terms is
-- rendering the built-in default (src/lib/pages.js -> getTermsVersion).
--
-- All three columns are nullable and deliberately NOT backfilled: no account or
-- order that predates this ever produced such a record, and inventing one would
-- be manufacturing evidence. NULL means "not recorded", never "declined".

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT;

-- AlterTable
-- Stamped per order as well as per account: the terms can change between the
-- day someone registers and the day they buy, and a purchase dispute is about
-- the terms in force on the day of the purchase.
ALTER TABLE "Order" ADD COLUMN     "termsVersion" TEXT;
