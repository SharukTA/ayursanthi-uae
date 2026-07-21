// Shared registration/account validation. Used by both the client form
// (src/app/(auth)/register/page.js) and the API route
// (src/app/api/auth/register/route.js) so the rules stay in one place and the
// server can never be bypassed by a hand-crafted request.

// Pragmatic email check: one @, a dotted domain, no whitespace. Deliberately
// not RFC 5322-exhaustive — the goal is to catch typos, not parse every legal
// address. Real deliverability is confirmed by the welcome email.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Indian mobile numbers: 10 digits starting 6-9, optionally prefixed with
// +91 / 91 / 0. We normalise to the bare 10-digit form before checking.
const PHONE_RE = /^[6-9]\d{9}$/;

export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 80;

/**
 * Strip a phone number down to the national 10-digit form, dropping spaces,
 * dashes, parentheses and a leading +91 / 91 / 0 country/trunk prefix.
 * Returns the cleaned string (may still be invalid — validate separately).
 */
export function normalizePhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/[\s\-()]/g, "");
  digits = digits.replace(/^\+?91/, "").replace(/^0+/, "");
  return digits;
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
  if (!EMAIL_RE.test(trimmed)) return "Please enter a valid email address.";
  return null;
}

/**
 * Phone is optional. Pass { required: true } to make a blank value an error.
 */
export function validatePhone(phone, { required = false } = {}) {
  const raw = String(phone || "").trim();
  if (!raw) return required ? "Please enter your mobile number." : null;
  const normalized = normalizePhone(raw);
  if (!PHONE_RE.test(normalized)) {
    return "Please enter a valid 10-digit mobile number.";
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
 * Validate a full registration payload. Returns a map of field -> message for
 * any fields that failed; an empty object means the payload is valid.
 */
export function validateRegistration({ name, email, phone, password }) {
  const errors = {};
  const nameError = validateName(name);
  if (nameError) errors.name = nameError;
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  const phoneError = validatePhone(phone);
  if (phoneError) errors.phone = phoneError;
  const passwordError = validatePassword(password);
  if (passwordError) errors.password = passwordError;
  return errors;
}
