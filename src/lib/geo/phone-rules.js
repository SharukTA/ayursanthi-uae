// Per-country phone number rules for the markets the store actually ships to.
//
// Deliberately curated rather than exhaustive: a wrong length here rejects a
// real customer at checkout, so we only encode countries whose numbering plans
// we are confident about. Every other country falls through to the permissive
// E.164 range in src/lib/validation.js — accepting an odd-looking number from
// Paraguay is much cheaper than losing the order.
//
// Field reference for each entry:
//   lengths     - allowed digit counts for the NATIONAL number, i.e. what is
//                 left after the country calling code. Trunk prefixes ("0" in
//                 the UK, India, Australia…) are not part of this count; the
//                 one exception is Italy, which keeps its leading 0, and whose
//                 range is widened to match.
//   prefix      - optional leading-digit rule. Only set where mobile numbers
//                 are the delivery norm AND the rule is unambiguous, because
//                 it is the check most likely to produce a false rejection.
//   prefixHint  - human phrasing of `prefix`, used to build the error message.
//   example     - a well-formed national number, shown to the user on failure.
//
// Numbers are grouped by region and kept in the same order as the region list
// so it stays obvious what is and isn't covered.

import { COUNTRIES, getCountry } from "@/lib/geo/countries";

export const PHONE_RULES = {
  // --- GCC / Middle East -------------------------------------------------
  // Mobile is 9 digits (5X XXX XXXX); landlines are 8 (area code + 7).
  AE: { lengths: [8, 9], example: "50 123 4567" },
  SA: { lengths: [9], example: "51 234 5678" },
  OM: { lengths: [8], example: "9123 4567" },
  QA: { lengths: [8], example: "3312 3456" },
  KW: { lengths: [8], example: "5012 3456" },
  BH: { lengths: [8], example: "3600 1234" },
  JO: { lengths: [8, 9], example: "7 9012 3456" },
  EG: { lengths: [8, 9, 10], example: "100 123 4567" },

  // --- South Asia --------------------------------------------------------
  // India is the strictest entry: couriers require a mobile, and every Indian
  // mobile series is 10 digits opening with 6-9. Matches Amazon.in's rule.
  IN: {
    lengths: [10],
    prefix: /^[6-9]/,
    prefixHint: "start with 6, 7, 8 or 9",
    example: "98765 43210",
  },
  PK: { lengths: [9, 10], example: "301 2345678" },
  BD: { lengths: [8, 9, 10], example: "1712 345678" },
  LK: { lengths: [9], example: "71 234 5678" },
  NP: { lengths: [8, 10], example: "9812 345678" },

  // --- North America -----------------------------------------------------
  // Both are NANP: 3-digit area code + 7-digit subscriber number.
  US: { lengths: [10], example: "415 555 0123" },
  CA: { lengths: [10], example: "416 555 0123" },

  // --- Europe ------------------------------------------------------------
  GB: { lengths: [9, 10], example: "7400 123456" },
  IE: { lengths: [7, 8, 9], example: "85 123 4567" },
  // Germany and Italy both have genuinely variable-length national numbers,
  // so these ranges are wide on purpose — length alone cannot say much.
  DE: { lengths: [6, 7, 8, 9, 10, 11], example: "151 23456789" },
  IT: { lengths: [6, 7, 8, 9, 10, 11], example: "312 345 6789" },
  FR: { lengths: [9], example: "6 12 34 56 78" },
  NL: { lengths: [9], example: "6 12345678" },
  ES: { lengths: [9], example: "612 345 678" },

  // --- Asia-Pacific ------------------------------------------------------
  AU: { lengths: [9], example: "412 345 678" },
  NZ: { lengths: [8, 9, 10], example: "21 123 4567" },
  SG: { lengths: [8], example: "8123 4567" },
  MY: { lengths: [9, 10], example: "12 345 6789" },
  PH: { lengths: [9, 10], example: "917 123 4567" },
  ID: { lengths: [9, 10, 11, 12], example: "812 3456 7890" },
  TH: { lengths: [8, 9], example: "81 234 5678" },
  HK: { lengths: [8], example: "9123 4567" },
  JP: { lengths: [9, 10], example: "90 1234 5678" },

  // --- Africa ------------------------------------------------------------
  ZA: { lengths: [9], example: "71 123 4567" },
};

// Longest dial codes first so "+1268" resolves to Antigua before "+1" picks up
// the US. Mirrors the matching order in src/components/PhoneField.js.
const BY_DIAL_DESC = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

/**
 * Rules indexed by dial code rather than ISO code, because a dial code is all
 * an E.164 string gives us on the server. Countries that share a dial code
 * (US/CA on "+1") are merged: the union of their allowed lengths, and a prefix
 * rule only where every sharing country agrees. The label degrades to the dial
 * code itself when it would otherwise have to pick one country arbitrarily.
 */
const RULES_BY_DIAL = (() => {
  const byDial = new Map();
  for (const [code, rule] of Object.entries(PHONE_RULES)) {
    const country = getCountry(code);
    if (!country) continue; // Guards against a typo'd ISO code above.
    const existing = byDial.get(country.dial);
    if (!existing) {
      byDial.set(country.dial, {
        dial: country.dial,
        lengths: [...rule.lengths],
        prefix: rule.prefix || null,
        prefixHint: rule.prefixHint || "",
        example: rule.example,
        names: [country.name],
      });
      continue;
    }
    existing.lengths = [...new Set([...existing.lengths, ...rule.lengths])].sort((a, b) => a - b);
    existing.names.push(country.name);
    // A prefix rule only survives if it is identical across the shared dial
    // code; otherwise one country's mobile series would reject another's.
    if (!rule.prefix || String(rule.prefix) !== String(existing.prefix)) {
      existing.prefix = null;
      existing.prefixHint = "";
    }
  }
  return byDial;
})();

/**
 * Split an E.164 string ("+919876543210") into its dial code and national
 * number, using the longest matching country calling code. Returns null for
 * anything without a leading "+" — a bare national number carries no country
 * information, so there is nothing to validate it against.
 */
export function splitE164(phone) {
  const raw = String(phone || "").trim();
  if (!raw.startsWith("+")) return null;
  const digits = raw.replace(/\D/g, "");
  const match = BY_DIAL_DESC.find((c) => digits.startsWith(c.dial) && digits.length > c.dial.length);
  if (!match) return null;
  return {
    country: match,
    dial: match.dial,
    national: digits.slice(match.dial.length),
  };
}

/** The curated rule for an ISO2 country code, or null if we have none. */
export function getPhoneRule(code) {
  return PHONE_RULES[String(code || "").toUpperCase()] || null;
}

/**
 * Longest national number the given country accepts, for capping input length
 * as the user types. Falls back to whatever E.164's 15-digit ceiling leaves
 * after the dial code, so uncurated countries still get a sane cap.
 */
export function getMaxNationalLength(code) {
  const rule = getPhoneRule(code);
  if (rule) return Math.max(...rule.lengths);
  const dial = getCountry(code)?.dial || "";
  return Math.max(4, 15 - dial.length);
}

// "10 digits" / "9 or 10 digits" / "6 to 11 digits" for a contiguous run.
function formatLengths(lengths) {
  if (lengths.length === 1) return `${lengths[0]} digits`;
  const min = lengths[0];
  const max = lengths[lengths.length - 1];
  const contiguous = lengths.every((n, i) => n === min + i);
  if (contiguous && lengths.length >= 4) return `${min} to ${max} digits`;
  return `${lengths.slice(0, -1).join(", ")} or ${max} digits`;
}

/**
 * Check a normalised E.164 number against its country's curated rule.
 * Returns an error message, or null when the number is fine — including the
 * common case where we simply have no rule for that country.
 */
export function validateNationalNumber(phone) {
  const parts = splitE164(phone);
  if (!parts) return null;

  const merged = RULES_BY_DIAL.get(parts.dial);
  if (!merged) return null;

  // Single-country dial codes read better by name ("United Arab Emirates
  // numbers…"); shared ones fall back to the code ("+1 numbers…").
  const label = merged.names.length === 1 ? merged.names[0] : `+${merged.dial}`;
  const national = parts.national;

  if (!merged.lengths.includes(national.length)) {
    const expected = formatLengths(merged.lengths);
    const example = merged.names.length === 1 ? ` For example: +${merged.dial} ${merged.example}.` : "";
    return `${label} phone numbers must be ${expected} after the country code — you entered ${national.length}.${example}`;
  }

  if (merged.prefix && !merged.prefix.test(national)) {
    return `${label} mobile numbers must ${merged.prefixHint}.`;
  }

  return null;
}
