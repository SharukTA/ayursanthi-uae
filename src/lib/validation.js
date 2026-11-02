// Shared registration/account validation. Used by both the client form
// (src/app/(auth)/register/page.js) and the API route
// (src/app/api/auth/register/route.js) so the rules stay in one place and the
// server can never be bypassed by a hand-crafted request.

import { validateNationalNumber } from "@/lib/geo/phone-rules";

// Pragmatic email check: one @, a dotted domain, no whitespace. Deliberately
// not RFC 5322-exhaustive — the goal is to catch typos, not parse every legal
// address. Real deliverability is confirmed by the welcome email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const EMAIL_MAX_LENGTH = 254; // RFC 5321 maximum address length.

// International phone numbers (E.164): an optional leading "+" country-code
// prefix followed by 7–15 digits. 15 is the ITU E.164 maximum (country code +
// national number) and 7 is a safe floor for the shortest national numbers.
// This is the outer bound every number must clear; numbers that carry a "+"
// country code we have curated data for are then checked against that
// country's actual numbering plan (see src/lib/geo/phone-rules.js).
const PHONE_RE = /^\+?\d{7,15}$/;

// Affiliate ID (a.k.a. referral code). Minted as up-to-4 letters + a 4-character
// tail, so 5–8 characters in practice; the bounds below are deliberately a
// little wider than that so a hand-typed or legacy code is never rejected by
// shape alone. Case and surrounding whitespace are not significant — every code
// is normalised to trimmed uppercase before it is stored or looked up.
const REFERRAL_CODE_RE = /^[A-Z0-9]+$/;
export const REFERRAL_CODE_MIN_LENGTH = 4;
export const REFERRAL_CODE_MAX_LENGTH = 16;

export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 80;

/**
 * Normalise a phone number to a compact international form: an optional leading
 * "+" (country-code prefix) followed by digits, with spaces, dashes,
 * parentheses and dots removed. We deliberately do NOT strip a country code or
 * a leading trunk "0" — with worldwide shipping there's no single country to
 * assume, so the number is kept as entered, just tidied. Returns the cleaned
 * string (may still be invalid — validate separately).
 */
export function normalizePhone(phone) {
  if (!phone) return "";
  const raw = String(phone).trim();
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  return hasPlus ? `+${digits}` : digits;
}

/**
 * A request's JSON body as a plain object, or an empty one for anything else. So `null`,
 * a list or a body that is not JSON gets a normal refusal rather than a server error.
 */
export async function readJsonObject(request) {
  const body = await request.json().catch(() => null);
  return body && typeof body === "object" && !Array.isArray(body) ? body : {};
}

/**
 * A redirect target from a URL as a path on this site, or null if it could lead anywhere
 * else. Browsers read a backslash as a slash and drop tabs and newlines from URLs, so
 * "/\evil.com" and "/<tab>/evil.com" both really mean "//evil.com", another site.
 */
export function safeRedirectPath(target) {
  if (typeof target !== "string" || !target.startsWith("/")) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(target)) return null;
  const base = "https://this-site.invalid";
  try {
    return new URL(target, base).origin === base ? target : null;
  } catch {
    return null;
  }
}

export function validateName(name) {
  const trimmed = String(name || "").trim();
  if (!trimmed) return "Please enter your name.";
  if (trimmed.length < 2) return "Name must be at least 2 characters long.";
  if (trimmed.length > NAME_MAX_LENGTH) return `Name must be ${NAME_MAX_LENGTH} characters or fewer.`;
  return null;
}

export function validateEmail(email) {
  const trimmed = String(email || "").trim();
  if (!trimmed) return "Please enter your email address.";
  if (trimmed.length > EMAIL_MAX_LENGTH) return "Please enter a valid email address.";
  if (!EMAIL_RE.test(trimmed)) return "Please enter a valid email address.";
  return null;
}

/**
 * Phone is optional. Pass { required: true } to make a blank value an error.
 *
 * Two layers: every number must be a plausible E.164 string (PHONE_RE), and a
 * number that carries a country code we have curated rules for must also match
 * that country's numbering plan — so "+91" demands exactly 10 digits starting
 * 6-9, while an uncurated country keeps the permissive check alone. Numbers
 * stored without a leading "+" (legacy rows) skip the country layer, since
 * there is no country to check them against.
 */
export function validatePhone(phone, { required = false } = {}) {
  const raw = String(phone || "").trim();
  if (!raw) return required ? "Please enter your phone number." : null;
  const normalized = normalizePhone(raw);
  if (!PHONE_RE.test(normalized)) {
    return "Please enter a valid phone number, including the country code.";
  }
  return validateNationalNumber(normalized);
}

/**
 * A required mobile number with its country code, for forms that ask for a mobile
 * rather than any number to reach someone on. validatePhone also allows UAE landlines,
 * which is right for a delivery contact, so UAE numbers get the stricter check here.
 * Other countries keep the rules in lib/geo/phone-rules.js.
 */
export function validateMobile(phone) {
  const error = validatePhone(phone, { required: true });
  if (error) return error;
  const normalized = normalizePhone(phone);
  if (!normalized.startsWith("+")) return "Please select your country code.";
  if (normalized.startsWith("+971") && !/^\+9715\d{8}$/.test(normalized)) {
    return "United Arab Emirates mobile numbers must be 9 digits starting with 5. For example: +971 50 123 4567.";
  }
  return null;
}

export function validatePassword(password) {
  const value = String(password || "");
  if (!value) return "Please enter a password.";
  if (value.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters long.`;
  }
  if (!/[a-zA-Z]/.test(value) || !/\d/.test(value)) {
    return "Password must contain at least one letter and one number.";
  }
  return null;
}

/**
 * Normalise an affiliate ID to the single form it is stored and compared in:
 * trimmed, uppercased, with internal spaces and dashes removed (people paste
 * "shar-001f" or "SHAR 001F"). Returns "" for a blank value.
 */
export function normalizeReferralCode(code) {
  return String(code || "")
    .trim()
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

/**
 * Shape check for an affiliate ID. Optional: a blank value is not an error,
 * because entering someone else's code is never required to sign up.
 *
 * This only rules out codes that could not possibly exist. Whether a
 * well-formed code belongs to a real account is a database question, answered
 * server-side in the register route — the client cannot be trusted with it and
 * must not be handed a way to enumerate accounts either.
 */
export function validateReferralCode(code) {
  const normalized = normalizeReferralCode(code);
  if (!normalized) return null;
  if (
    normalized.length < REFERRAL_CODE_MIN_LENGTH ||
    normalized.length > REFERRAL_CODE_MAX_LENGTH ||
    !REFERRAL_CODE_RE.test(normalized)
  ) {
    return "That affiliate ID doesn't look right. Please check it and try again.";
  }
  return null;
}

/**
 * Validate a full registration payload. Returns a map of field -> message for
 * any fields that failed; an empty object means the payload is valid.
 *
 * Phone is required at signup: it is the fallback contact for a delivery and
 * doubles as a login identifier, so an account without one is a dead end.
 */
export function validateRegistration({ name, email, phone, password }) {
  const errors = {};
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  const phoneError = validatePhone(phone, { required: true });
  if (phoneError) errors.phone = phoneError;
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;
  return errors;
}
