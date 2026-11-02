// The parts of the My Shop programme that more than one side needs: the admin
// form, the partner's page and src/proxy.js. No Prisma and no node:crypto, because
// proxy.js runs on every page request and the rest runs in the browser. Everything
// that touches the database or a secret lives in lib/shop.js.

// The published plan: what a partner puts in, and the share of goods they earn.
export const SHOP_TIERS = [
  { investmentAed: 1000, commissionRate: 10 },
  { investmentAed: 10000, commissionRate: 13 },
  { investmentAed: 25000, commissionRate: 14 },
  { investmentAed: 50000, commissionRate: 15 },
];

export function findShopTier(investmentAed) {
  // Number([10000]) is 10000, so a list from a hand-made request would otherwise pass.
  if (Array.isArray(investmentAed)) return null;
  const amount = Number(investmentAed);
  return SHOP_TIERS.find((tier) => tier.investmentAed === amount) ?? null;
}

// Deliberately neutral names. Both are visible to a shopper who clicks an advert
// (the parameter in the URL until proxy.js strips it, the cookie in devtools), and
// neither should advertise that a partner programme exists.
export const SHOP_LINK_PARAM = "via";
export const SHOP_ATTRIBUTION_COOKIE = "via";

// How long after clicking a link the shopper's purchases still credit that shop.
export const SHOP_ATTRIBUTION_DAYS = 30;

const LINK_CODE_RE = /^[a-z0-9]{6,16}$/;

export function isValidLinkCode(code) {
  return typeof code === "string" && LINK_CODE_RE.test(code);
}

/** Adds a shop's public code to any page on the site. */
export function buildShopLink(origin, path, linkCode) {
  return `${origin}${path}?${SHOP_LINK_PARAM}=${linkCode}`;
}

// The periods a shop's report can be read over.
export const SHOP_REPORT_RANGES = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];

function readPageNumber(value) {
  const page = typeof value === "string" && /^\d{1,6}$/.test(value) ? Number(value) : 1;
  return Math.max(page, 1);
}

/** A report's period and pages from URL parameters, tolerating anything typed there. */
export function readShopReportQuery({ range, page, rpage } = {}) {
  return {
    range: SHOP_REPORT_RANGES.some((entry) => entry.key === range) ? range : "all",
    page: readPageNumber(page),
    referralPage: readPageNumber(rpage),
  };
}

/** The same query as URL parameters, leaving out whatever is at its default. */
export function shopReportQueryString({ range, page, referralPage }) {
  const params = new URLSearchParams();
  if (range !== "all") params.set("range", range);
  if (page > 1) params.set("page", String(page));
  if (referralPage > 1) params.set("rpage", String(referralPage));
  const text = params.toString();
  return text ? `?${text}` : "";
}

// The referrer's percentage of each sale made by a shop they referred, used until an
// admin sets another in /admin/settings.
export const DEFAULT_SHOP_REFERRAL_RATE = 10;

/** A stored percentage as a number, falling back to the default if it is unusable. */
export function normalizeShopReferralRate(raw) {
  const rate = Number(raw);
  const usable = raw != null && String(raw).trim() !== "" && Number.isFinite(rate);
  // To 2 decimals, the most a sale can store, so the rate recorded on a sale is the rate
  // its profit was worked out at.
  return usable && rate >= 0 && rate <= 100 ? Math.round(rate * 100) / 100 : DEFAULT_SHOP_REFERRAL_RATE;
}

// The available balance a partner has to reach before they can be paid, used until an
// admin sets another in /admin/settings.
export const DEFAULT_SHOP_WITHDRAWAL_MINIMUM = 50;

/** A stored minimum as a number. Zero is legal, and means any balance can be paid. */
export function normalizeShopWithdrawalMinimum(raw) {
  const minimum = Number(raw);
  const usable = raw != null && String(raw).trim() !== "" && Number.isFinite(minimum);
  return usable && minimum >= 0 ? minimum : DEFAULT_SHOP_WITHDRAWAL_MINIMUM;
}

const SHOP_REFERRAL_CODE_RE = /^[A-Z0-9]{6,16}$/;

/** Takes a code already passed through normalizeShopCode. */
export function isValidShopReferralCode(code) {
  return SHOP_REFERRAL_CODE_RE.test(code);
}

export const SHOP_CODE_MIN_LENGTH = 12;
export const SHOP_CODE_MAX_LENGTH = 24;

const SHOP_CODE_RE = /^[A-Z0-9]+$/;

/**
 * The one form an access or referral code is compared in: trimmed, uppercased, with
 * spaces and dashes removed, so "abcd-efgh" and "ABCD EFGH" are the same code.
 */
export function normalizeShopCode(code) {
  return String(code || "")
    .trim()
    .replace(/[\s-]/g, "")
    .toUpperCase();
}

const SHOP_CODE_COMMON_WORDS = ["PASSWORD", "QWERTY", "AYURSHOPPEE", "AYURSANTHI", "SHOPCODE", "WELCOME", "ADMIN"];
const SHOP_CODE_MIN_DISTINCT = 6;
const SHOP_CODE_SEQUENCES = ["ABCDEFGHIJKLMNOPQRSTUVWXYZ", "0123456789"];
const SHOP_CODE_SEQUENCE_LENGTH = 5;

function hasSequence(code) {
  for (const sequence of SHOP_CODE_SEQUENCES) {
    for (let i = 0; i + SHOP_CODE_SEQUENCE_LENGTH <= sequence.length; i += 1) {
      if (code.includes(sequence.slice(i, i + SHOP_CODE_SEQUENCE_LENGTH))) return true;
    }
  }
  return false;
}

// The parts of an owner's details someone could guess a code from.
function guessableParts({ ownerName, email, phone } = {}) {
  const words = String(ownerName ?? "").toUpperCase().split(/[^A-Z0-9]+/);
  const mailbox = String(email ?? "").split("@")[0].toUpperCase().replace(/[^A-Z0-9]/g, "");
  const digits = String(phone ?? "").replace(/\D/g, "");
  return [...words, mailbox, digits.slice(-6)].filter((part) => part.length >= 3);
}

/**
 * Whether an admin-typed code is hard enough to guess. The code is the partner's only
 * credential, with no username beside it, and one guess is tried against every shop.
 * Generated codes do not come through here.
 *
 * @param {string} code
 * @param {{ownerName?: string, email?: string, phone?: string}} [owner]  so that a code
 *   cannot be built from the owner's own name, email or mobile
 * @returns {string|null} what is wrong, or null
 */
export function validateShopCode(code, owner) {
  const normalized = normalizeShopCode(code);
  if (
    normalized.length < SHOP_CODE_MIN_LENGTH ||
    normalized.length > SHOP_CODE_MAX_LENGTH ||
    !SHOP_CODE_RE.test(normalized)
  ) {
    return `A shop code must be ${SHOP_CODE_MIN_LENGTH}-${SHOP_CODE_MAX_LENGTH} letters and numbers.`;
  }
  if (!/[A-Z]/.test(normalized) || !/\d/.test(normalized)) {
    return "A shop code must have both letters and numbers.";
  }
  if (
    new Set(normalized).size < SHOP_CODE_MIN_DISTINCT ||
    hasSequence(normalized) ||
    SHOP_CODE_COMMON_WORDS.some((word) => normalized.includes(word))
  ) {
    return "That shop code is too easy to guess. Please choose another, or leave it blank to generate one.";
  }
  if (guessableParts(owner).some((part) => normalized.includes(part))) {
    return "A shop code cannot contain the owner's name, email or mobile number. Please choose another, or leave it blank to generate one.";
  }
  return null;
}
