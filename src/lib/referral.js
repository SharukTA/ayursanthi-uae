// The affiliate / referral program.
//
// Every customer is minted an "affiliate ID" (User.referralCode) the moment
// they register. Anyone signing up afterwards may type that ID into the
// register form; doing so stamps User.referredById on the new account, which is
// what puts them in the referrer's "My Referrals" list.
//
// Deliberately just attribution: one level deep, no commission, no wallet, no
// payout. A referrer sees who joined through them and nothing else moves.
//
// The program is for CUSTOMERS only. Staff accounts are not in it: an admin has
// no affiliate ID to share, does not get a referrals page, and cannot be named
// as someone's referrer. That rule is enforced at every read (see
// canHaveAffiliateId below) rather than only in stored data, so promoting a
// customer to admin retires their ID immediately without a data migration.
//
// Server-only — this module talks to the database. The pieces the browser also
// needs (normalising and shape-checking a typed code) live in lib/validation.js
// so the register form can share them without pulling Prisma into the bundle.

import { prisma } from "@/lib/prisma";
import { normalizeReferralCode } from "@/lib/validation";

// Characters a freshly minted tail may use. I and O are omitted on purpose:
// codes get read off a screen and typed by someone else, and "I vs 1" / "O vs 0"
// is the mistake that costs a referral. That still leaves 34 symbols.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
const CODE_TAIL_LENGTH = 4;

// How many times to re-roll on a collision before giving up. Each roll has
// ~1.3M possible tails per name prefix, so needing even two is already unusual;
// the cap exists purely so a pathological database can't spin forever.
const MAX_MINT_ATTEMPTS = 8;

/**
 * Whether an account of this role takes part in the affiliate program.
 *
 * The signup route only ever creates CUSTOMERs, so in practice this excludes
 * exactly one thing: an admin. Kept as a named predicate because the same
 * question is asked in three places and "role !== ADMIN" on its own does not
 * say why.
 */
export function canHaveAffiliateId(role) {
  return role !== "ADMIN";
}

/**
 * Mint one candidate affiliate ID: up to 4 letters from the person's name plus
 * a random tail, e.g. "SHAR7K2D". The name prefix is cosmetic — it makes the ID
 * recognisably theirs when they read it out — and the tail is what actually
 * distinguishes it. A name with no ASCII letters falls back to "USR".
 */
export function generateReferralCode(name) {
  const prefix =
    String(name || "")
      .replace(/[^a-zA-Z]/g, "")
      .slice(0, 4)
      .toUpperCase() || "USR";

  let tail = "";
  for (let i = 0; i < CODE_TAIL_LENGTH; i += 1) {
    tail += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `${prefix}${tail}`;
}

/**
 * Mint an affiliate ID that is free in the database, re-rolling on collision.
 *
 * The uniqueness check here is advisory, not a guarantee — two signups can pass
 * it in the same instant. The @unique index on User.referralCode is the real
 * guard, and the register route retries on the resulting write conflict.
 *
 * @param {string} name              the new customer's name, for the prefix
 * @param {object} [client]          prisma client or transaction client
 * @returns {Promise<string>}
 */
export async function createUniqueReferralCode(name, client = prisma) {
  for (let attempt = 0; attempt < MAX_MINT_ATTEMPTS; attempt += 1) {
    const code = generateReferralCode(name);
    const taken = await client.user.findUnique({
      where: { referralCode: code },
      select: { id: true },
    });
    if (!taken) return code;
  }
  // Every roll collided, which in practice means something is very wrong with
  // the randomness. Fall back to a code that cannot collide by construction.
  return `USR${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Look up the account an affiliate ID belongs to.
 *
 * Returns null both for a blank code and for one that matches nobody — the
 * caller decides which of those is an error. Matching is exact on the
 * normalised (trimmed, uppercase) form, so "shar 7k2d" finds SHAR7K2D.
 *
 * findFirst rather than findUnique so the role can be filtered too: an admin is
 * never a valid referrer, even if the row still carries a code from before they
 * were promoted. Still a single index hit — referralCode is unique.
 *
 * @param {string} code
 * @param {object} [client]
 * @returns {Promise<{id: string, name: string}|null>}
 */
export async function findReferrerByCode(code, client = prisma) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;

  return client.user.findFirst({
    where: { referralCode: normalized, role: "CUSTOMER" },
    select: { id: true, name: true },
  });
}

/**
 * Read a user's affiliate ID, minting one if the account somehow has none.
 *
 * Every account created through the signup route already has a code and every
 * pre-existing customer was backfilled by the migration, so this normally just
 * reads. It exists so an account created some other way (a seed script, a
 * hand-inserted row) still gets a working referrals page instead of an empty
 * box the customer cannot act on.
 *
 * @param {string} userId
 * @returns {Promise<string|null>} null if the user does not exist, or is staff
 *   and therefore not in the program
 */
export async function ensureReferralCode(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true, referralCode: true },
  });
  if (!user) return null;
  // Never mint for staff — and never hand back a stale code a promoted
  // customer still carries.
  if (!canHaveAffiliateId(user.role)) return null;
  if (user.referralCode) return user.referralCode;

  const code = await createUniqueReferralCode(user.name);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { referralCode: code },
    select: { referralCode: true },
  });
  return updated.referralCode;
}
