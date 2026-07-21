import crypto from "crypto";
import { cookies } from "next/headers";

const SESSION_SECRET = process.env.SESSION_SECRET || "ayursanthi_super_secret_session_key_1234567890_fallback";
// Ensure key is exactly 32 bytes for aes-256-gcm
const key = crypto.scryptSync(SESSION_SECRET, "ayursanthi-salt", 32);

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
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(JSON.stringify(payload), "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${encrypted}:${tag}`;
}

/**
 * Decrypts and validates a session token string.
 * @param {string} sessionToken 
 * @returns {object|null} Decrypted payload, or null if invalid
 */
export function decryptSession(sessionToken) {
  try {
    const [ivHex, encrypted, tagHex] = sessionToken.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted);
  } catch (err) {
    return null;
  }
}

/**
 * Encrypts payload and stores it in an HTTP-only cookie.
 * @param {object} payload 
 */
export async function setSession(payload) {
  const token = encryptSession(payload);
  const cookieStore = await cookies();
  cookieStore.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
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
