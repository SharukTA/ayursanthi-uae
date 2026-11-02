import crypto from "crypto";

// Pure session-token crypto: no database, no next/headers. Kept as its own leaf
// module so `src/proxy.js` — which runs on every single page request — can read
// a cookie without dragging Prisma Client into that bundle. Everything that
// needs cookies or the database lives in `src/lib/auth.js`, which re-exports
// these for callers that only want the primitives.

// How long a session stays valid. Enforced server-side via the `exp` claim
// below — NOT just by the cookie's maxAge, which the client controls and can
// simply be edited or replayed after it "expires".
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

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
  cachedKey = deriveKey("ayursanthi-salt");
  return cachedKey;
}

function deriveKey(salt) {
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
    return crypto.scryptSync("ayursanthi-development-only-key", salt, 32);
  }

  // Ensure key is exactly 32 bytes for aes-256-gcm
  return crypto.scryptSync(secret, salt, 32);
}

/**
 * A key for encrypting something other than sessions. Each purpose has its own salt,
 * so a value encrypted for one can never be read as, or passed off as, another.
 * @param {string} purpose
 * @returns {Buffer} 32-byte key for aes-256-gcm
 */
export function derivePurposeKey(purpose) {
  return deriveKey(`ayursanthi-${purpose}`);
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
 *
 * NOTE: this is the *cryptographic* check only. It cannot tell that a password
 * was changed since the token was minted — that needs the database, and lives in
 * `getSession()` (src/lib/auth.js). Use this directly only where a stale-but-
 * genuine cookie is acceptable, i.e. the optimistic redirect layer in proxy.js.
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
