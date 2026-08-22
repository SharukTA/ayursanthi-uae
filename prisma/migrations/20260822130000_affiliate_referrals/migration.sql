-- Affiliate / referral program.
--
-- Every customer gets a shopper-facing "affiliate ID" (User.referralCode) at
-- signup. Someone registering later may type that code into the register form,
-- which stamps User.referredById on the new account — so A can see B in their
-- "My Referrals" list. One level only: there is no chain and no commission,
-- this is purely attribution.
--
-- referralCode is nullable so accounts that predate the program are legal, but
-- every existing row is backfilled below — the column ends up fully populated,
-- and only rows created outside the signup route (none today) could ever be
-- null. The API mints one lazily for those, so the app never has to assume it
-- is present.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT;

-- Backfill: mint a code for every account that already exists.
--
-- Format matches what the app mints for new signups (src/lib/referral.js):
-- up to 4 letters from the name + a 4-character tail, e.g. "SHAR001F". The tail
-- here is the row's position in a stable ordering rather than random, which is
-- what makes uniqueness a certainty instead of a probability — a globally
-- unique tail cannot collide no matter how the name prefixes line up.
-- Names with no ASCII letters at all (e.g. Arabic-only) fall back to "USR".
WITH numbered AS (
    SELECT
        "id",
        COALESCE(
            NULLIF(UPPER(regexp_replace("name", '[^a-zA-Z]', '', 'g')), ''),
            'USR'
        ) AS letters,
        ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS rn
    FROM "User"
)
UPDATE "User" u
SET "referralCode" = UPPER(LEFT(n.letters, 4) || LPAD(TO_HEX(n.rn), 4, '0'))
FROM numbered n
WHERE u."id" = n."id";

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE INDEX "User_referredById_createdAt_idx" ON "User"("referredById", "createdAt");

-- AddForeignKey
-- SET NULL, not CASCADE: deleting a referrer must orphan their referrals'
-- attribution, never delete the referred customers themselves.
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
