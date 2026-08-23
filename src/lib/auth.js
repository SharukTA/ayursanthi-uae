import crypto from "crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import {
  decryptSession,
  encryptSession,
  SESSION_MAX_AGE_SECONDS,
} from "@/lib/session-token";

// The token crypto itself lives in session-token.js (a prisma-free leaf module
// so proxy.js can use it without pulling Prisma Client into the request path).
// Re-exported here so existing importers keep working unchanged.
export { decryptSession, encryptSession, SESSION_MAX_AGE_SECONDS };

// ── Password hashing ────────────────────────────────────────────────────────
//
// Format: pbkdf2$sha512$<iterations>$<saltHex>$<hashHex>
//
// The iteration count is stored INSIDE the hash rather than read from the
// constant below at verify time. That is what makes raising it safe: every row
// is verified at the cost it was written with, so old and new hashes coexist and
// nobody is locked out. `needsRehash()` then tells a caller that is holding the
// correct plaintext (i.e. a successful login) to write the row back at the
// current cost.
const PBKDF2_DIGEST = "sha512";
const PBKDF2_KEYLEN = 64;
// OWASP's floor for PBKDF2-HMAC-SHA512. The previous value here was 1000, which
// is ~200x too cheap — a stolen database of those hashes is crackable on
// commodity hardware. Legacy rows are re-hashed at this cost on next login.
const PBKDF2_ITERATIONS = 210000;

// Rows written before the format above: "<saltHex>:<hashHex>", always 1000
// iterations of PBKDF2-SHA512. Still accepted at login (and upgraded on the
// spot), never written again.
const LEGACY_ITERATIONS = 1000;

function derive(password, salt, iterations) {
  return crypto
    .pbkdf2Sync(String(password), salt, iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST)
    .toString("hex");
}

/**
 * Parses either hash format into one common shape.
 * @returns {{salt: string, hash: string, iterations: number}|null}
 */
function parseStoredHash(storedPasswordHash) {
  const stored = String(storedPasswordHash || "");
  if (!stored) return null;

  if (stored.startsWith("pbkdf2$")) {
    const [, digest, iterations, salt, hash] = stored.split("$");
    if (digest !== PBKDF2_DIGEST || !salt || !hash) return null;
    const rounds = Number(iterations);
    if (!Number.isInteger(rounds) || rounds < 1) return null;
    return { salt, hash, iterations: rounds };
  }

  // Legacy "salt:hash".
  const parts = stored.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { salt: parts[0], hash: parts[1], iterations: LEGACY_ITERATIONS };
}

/**
 * Hashes a plain password using PBKDF2, at the current cost.
 * @param {string} password
 * @returns {string} The formatted hash string
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = derive(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_DIGEST}$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

/**
 * Verifies a password against a stored hash, in either format.
 *
 * The comparison is constant-time. A plain `===` leaks, through how long it
 * takes to fail, how many leading characters of the derived hash were right —
 * the same class of bug the OTP path already avoids with timingSafeEqual.
 * @param {string} password
 * @param {string} storedPasswordHash
 * @returns {boolean} True if password matches, false otherwise
 */
export function verifyPassword(password, storedPasswordHash) {
  const parsed = parseStoredHash(storedPasswordHash);
  if (!parsed) return false;

  const candidate = Buffer.from(derive(password, parsed.salt, parsed.iterations), "hex");
  const expected = Buffer.from(parsed.hash, "hex");
  if (expected.length === 0 || candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(candidate, expected);
}

/**
 * True when a stored hash was written at a weaker cost (or in the legacy format)
 * than we use now. Call it only after verifyPassword() has returned true — the
 * plaintext is needed to write the replacement.
 * @param {string} storedPasswordHash
 */
export function needsRehash(storedPasswordHash) {
  const parsed = parseStoredHash(storedPasswordHash);
  if (!parsed) return false;
  return parsed.iterations < PBKDF2_ITERATIONS;
}

// ── Session cookie ──────────────────────────────────────────────────────────

/**
 * Encrypts payload and stores it in an HTTP-only cookie.
 * @param {object} payload
 */
export async function setSession(payload) {
  const issuedAt = Date.now();
  // `iat`/`exp` travel inside the encrypted (and GCM-authenticated) payload, so
  // they cannot be tampered with. `exp` is checked on every read in
  // decryptSession; `iat` is what getSession() compares against the account's
  // sessionsValidFrom stamp.
  //
  // Anything the caller passed through is overwritten here — including a stale
  // `iat`/`exp` spread from an old session object, as /api/user/profile does.
  const token = encryptSession({
    ...payload,
    iat: issuedAt,
    exp: issuedAt + SESSION_MAX_AGE_SECONDS * 1000,
  });
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

/**
 * Reads the account's session cut-off: any token minted before this instant is
 * refused. Moved forward by every password change and every password reset.
 *
 * Wrapped in React's `cache()` so the lookup happens at most once per request no
 * matter how many components and helpers call getSession() — the root layout,
 * the page, and any route helper all share the one result. This is the pattern
 * the Next.js authentication guide prescribes for a session DAL.
 */
const readSessionFloor = cache(async (userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { sessionsValidFrom: true },
  });
  // A missing row means the account is gone — treat every token as invalid.
  if (!user) return Number.POSITIVE_INFINITY;
  return user.sessionsValidFrom ? new Date(user.sessionsValidFrom).getTime() : 0;
});

/**
 * Retrieves, decrypts and validates the current user session.
 *
 * Two layers: the cryptographic check in decryptSession (authenticity +
 * expiry), then a database check that the token was minted after the account's
 * last password change. Without that second layer, resetting a password does
 * nothing to a cookie an attacker already stole — they keep the account for the
 * rest of the 7-day window, which defeats the main reason anyone resets.
 *
 * @returns {Promise<object|null>}
 */
export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");
  if (!sessionCookie) return null;

  const payload = decryptSession(sessionCookie.value);
  if (!payload?.userId) return null;

  try {
    const floor = await readSessionFloor(payload.userId);
    // Tokens minted before sessionsValidFrom are revoked. A token with no `iat`
    // predates the claim entirely and cannot be shown to be current, so it
    // survives only while the account has never revoked anything.
    const issuedAt = typeof payload.iat === "number" ? payload.iat : 0;
    if (issuedAt < floor) return null;
  } catch (error) {
    // The session is cryptographically valid and we simply cannot reach the
    // database to check for a revocation. Signing every shopper out because the
    // DB blinked is the worse failure — and any route that goes on to read data
    // will hit the same outage and fail on its own terms.
    console.error("[auth] Could not verify session freshness:", error?.message || error);
  }

  return payload;
}

/**
 * The Prisma update payload that revokes every session issued for an account up
 * to now. Returned rather than executed so the caller can fold it into the same
 * transaction as the password write — the two must never land separately.
 */
export function revokeSessionsData() {
  return { sessionsValidFrom: new Date() };
}

/**
 * Clears the session cookie on logout.
 */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
