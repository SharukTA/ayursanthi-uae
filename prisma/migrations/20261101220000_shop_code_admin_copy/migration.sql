-- An encrypted copy of each shop's access code, so an admin can look it up. Empty for
-- shops that already exist: their codes were only ever stored as hashes and cannot be
-- recovered, so an admin has to replace those for them to appear.

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "accessCodeEncrypted" TEXT;
