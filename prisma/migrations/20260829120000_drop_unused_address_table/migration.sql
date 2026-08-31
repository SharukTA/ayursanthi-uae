-- Drop the `Address` table.
--
-- It was never used. The only code that ever referenced it in this repo's
-- history was a `prisma.address.deleteMany()` in a demo seed script — there has
-- never been a create or update path, no address-book page, and checkout has
-- always written the shipping address to `Order.addressSnapshot` instead. The
-- table is therefore empty, and its columns still described the retired
-- line1/city/state/postalCode format with a `country` default of 'India'.
--
-- Shipping addresses live in `Order.addressSnapshot` (JSON), which is what the
-- admin CSV export reads. That snapshot is per-order and frozen at order time,
-- so exporting a historical order gives the address the parcel actually went to
-- rather than wherever that customer lives now.
--
-- If a saved-address book is ever built, a new table shaped to the UAE fields
-- in lib/address.js is the right way to add it — reviving this one is not.

-- DropForeignKey
ALTER TABLE "Address" DROP CONSTRAINT IF EXISTS "Address_userId_fkey";

-- DropTable
DROP TABLE IF EXISTS "Address";
