import crypto from "crypto";
import { cookies } from "next/headers";

// How long a session stays valid. Enforced server-side via the `exp` claim
// below — NOT just by the cookie's maxAge, which the client controls and can
// simply be edited or replayed after it "expires".
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

// The signing/encryption key is derived lazily and cached, so a missing secret
// fails auth closed rather than crashing the whole app at import time.
let cachedKey = null;

/**
 * Derives the AES key from SESSION_SECRET.
 *
 * There is deliberately NO hardcoded production fallback: a default committed to
 * the repo is a publicly-known key, and anyone could use it to mint themselves
 * an `ADMIN` session cookie. If the secret is missing in production we throw, so
 * sessions cannot be issued or accepted at all (fail closed).
 * @returns {Buffer} 32-byte key for aes-256-gcm
 */
function getKey() {
  if (cachedKey) return cachedKey;

  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET is missing or too short (min 32 chars). Refusing to use a " +
          "default key — generate one with: openssl rand -base64 48"
      );
    }
    console.warn(
      "[auth] SESSION_SECRET missing or too short — using an INSECURE development key. " +
        "Set SESSION_SECRET in .env before deploying."
    );
    cachedKey = crypto.scryptSync("ayursanthi-development-only-key", "ayursanthi-salt", 32);
    return cachedKey;
  }

  // Ensure key is exactly 32 bytes for aes-256-gcm
  cachedKey = crypto.scryptSync(secret, "ayursanthi-salt", 32);
  return cachedKey;
}

/**
 * Hashes a plain password using PBKDF2.
 * @param {string} password 
 * @returns {string} The formatted salt:hash string
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verifies a password against a stored PBKDF2 hash string.
 * @param {string} password 
 * @param {string} storedPasswordHash 
 * @returns {boolean} True if password matches, false otherwise
 */
export function verifyPassword(password, storedPasswordHash) {
  if (!storedPasswordHash || !storedPasswordHash.includes(":")) {
    return false;
  }
  const [salt, originalHash] = storedPasswordHash.split(":");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return hash === originalHash;
}

/**
 * Encrypts a session payload into a secure string.
 * @param {object} payload 
 * @returns {string} Encrypted token string
 */
export function encryptSession(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  let encrypted = cipher.update(JSON.stringify(payload), "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${tag}`;
}

/**
 * Decrypts and validates a session token string.
 *
 * Rejects tokens that are expired or carry no `exp` claim. Tokens issued before
 * expiry was introduced have no `exp` and are therefore treated as expired —
 * those users simply log in once more.
 * @param {string} sessionToken
 * @returns {object|null} Decrypted payload, or null if invalid/expired
 */
export function decryptSession(sessionToken) {
  try {
    const parts = String(sessionToken).split(":");
    if (parts.length !== 3) return null;

    const [ivHex, encrypted, tagHex] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    // Enforce the full 12-byte IV and 128-bit auth tag.
    //
    // This matters: Buffer.from(x, "hex") silently stops at the first invalid
    // character, so a token ending in non-hex yields a SHORTER tag — and Node
    // accepts GCM tags as small as 4 bytes when authTagLength isn't pinned. An
    // attacker could therefore truncate the tag and have GCM verify only the
    // bytes they kept, defeating tamper detection. Both lengths are checked
    // here and authTagLength is pinned below.
    if (iv.length !== 12 || tag.length !== 16) return null;

    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv, {
      authTagLength: 16,
    });
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    const payload = JSON.parse(decrypted);

    // Server-side expiry. Without this a captured cookie is valid forever,
    // since the 7-day maxAge is only ever enforced by the browser.
    if (typeof payload?.exp !== "number" || payload.exp <= Date.now()) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}

/**
 * Encrypts payload and stores it in an HTTP-only cookie.
 * @param {object} payload 
 */
export async function setSession(payload) {
  const issuedAt = Date.now();
  // `exp` travels inside the encrypted (and GCM-authenticated) payload, so it
  // cannot be tampered with, and is checked on every read in decryptSession.
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
 * Retrieves and decrypts the current user session.
 * @returns {Promise<object|null>}
 */
export async function getSession() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");
  if (!sessionCookie) return null;
  return decryptSession(sessionCookie.value);
}

/**
 * Clears the session cookie on logout.
 */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
}
