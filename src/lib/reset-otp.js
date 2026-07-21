// Helpers shared by the forgot/reset password OTP routes. Keeping the OTP
// generation, hashing and lookup rules in one place means the "send" and
// "verify" endpoints can never drift apart on how a code is validated.

import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/validation";

// How long a code stays valid, and how many wrong guesses we tolerate before
// the code is burned. Kept deliberately small — an OTP is low-entropy (6 digits)
// so short expiry + a tight attempt cap are what make it safe.
export const OTP_EXPIRY_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 5;
// Minimum gap between "resend" requests for the same account, in seconds.
export const OTP_RESEND_THROTTLE_SECONDS = 30;

/** Generate a random 6-digit numeric OTP as a zero-padded string. */
export function generateOtp() {
  // 0 – 999999, left-padded so codes like "004213" are always 6 chars.
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/** SHA-256 hash of a code — the only form we ever persist. */
export function hashOtp(otp) {
  return crypto.createHash("sha256").update(String(otp)).digest("hex");
}

/**
 * Constant-time comparison of a submitted code against a stored hash.
 * @returns {boolean}
 */
export function otpMatches(submitted, storedHash) {
  if (!storedHash) return false;
  const a = Buffer.from(hashOtp(submitted), "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Look up a user by the value typed on the forgot-password form. Accepts an
 * email or an Indian mobile number, mirroring the login route's identifier
 * handling. Returns null when nothing matches.
 *
 * @param {string} identifier
 */
export async function findUserByIdentifier(identifier) {
  const cleaned = String(identifier || "").trim();
  if (!cleaned) return null;

  const asPhone = normalizePhone(cleaned);
  return prisma.user.findFirst({
    where: {
      OR: [
        { email: cleaned.toLowerCase() },
        ...(asPhone ? [{ phone: asPhone }] : []),
      ],
    },
  });
}

/**
 * Fetch the most recent still-usable OTP row for a user (unconsumed and not
 * expired). Attempt-cap enforcement is left to the caller so it can burn the
 * code and message the user appropriately.
 *
 * @param {string} userId
 */
export function findActiveOtp(userId) {
  return prisma.passwordResetOtp.findFirst({
    where: {
      userId,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Mask an email for display in the UI, Amazon-style: keep the first character
 * of the local part and the domain, star out the rest. e.g. a***@gmail.com
 */
export function maskEmail(email) {
  const value = String(email || "");
  const [local, domain] = value.split("@");
  if (!local || !domain) return value;
  const head = local.slice(0, 1);
  return `${head}${"*".repeat(Math.max(3, local.length - 1))}@${domain}`;
}
