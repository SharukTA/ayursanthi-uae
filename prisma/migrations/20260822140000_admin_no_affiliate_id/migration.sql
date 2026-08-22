-- Retires affiliate IDs on staff accounts.
--
-- The affiliate program is for customers. The previous migration backfilled a
-- code onto every existing row indiscriminately, which handed the admin account
-- one (e.g. "ADMI0001") it has no use for — there is no referrals page for
-- staff and an admin must never be attributable as someone's referrer.
--
-- Only the code is cleared. Any "referredById" already pointing at a staff row
-- is deliberately left alone: undoing a real signup's attribution would be
-- destroying history to tidy up a column, and the read path already refuses to
-- treat staff as referrers regardless of what is stored.
--
-- This is a one-off cleanup, not the rule. The rule lives in the read path
-- (canHaveAffiliateId in src/lib/referral.js), so a customer promoted to admin
-- later stops having an affiliate ID immediately, with no migration needed.

UPDATE "User" SET "referralCode" = NULL WHERE "role" = 'ADMIN';
