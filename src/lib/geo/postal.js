// Postal-code and subdivision labelling, keyed by ISO 3166-1 alpha-2 code.
//
// Two separate problems live here:
//
//   1. Some countries have no postal-code system at all. The UAE is the one
//      that matters most to this store: there are no ZIP codes, addresses are
//      written as building / street / area / emirate, and businesses that need
//      one use a PO Box. Requiring a postal code would reject every genuine
//      local delivery address, so the field must be optional for them — see
//      countryUsesPostalCode() below, which both the checkout form and the
//      order API consult so client and server agree on what is required.
//
//   2. The word for a first-level subdivision and for a postal code differs by
//      market ("Emirate" vs "State", "PIN code" vs "ZIP code"). Shoppers fill a
//      form faster when it uses the words they'd use themselves.
//
// Curated rather than exhaustive, the same trade-off as geo/phone-rules.js: an
// unlisted country falls back to the generic labels and keeps the postal code
// required, which is correct for the large majority of the world.

// Countries with no national postal-code system (UPU). Anyone here gets an
// optional postal-code field. Restricted to the markets this store plausibly
// ships to rather than the full global list.
const NO_POSTAL_CODE = new Set([
  "AE", // United Arab Emirates — PO Box only
  "BH", // Bahrain
  "QA", // Qatar
  "KW", // Kuwait
  "OM", // Oman uses codes but they are rarely known/used
  "HK", // Hong Kong
  "MO", // Macau
  "PA", // Panama
  "AO", "BJ", "BW", "BF", "BI", "CM", "CF", "KM", "CG", "CD", "CI", "DJ",
  "GQ", "ER", "FJ", "GM", "GH", "GY", "JM", "KE", "KI", "LY", "MW", "ML",
  "MR", "MU", "NR", "RW", "ST", "SC", "SL", "SB", "SO", "SR", "SY", "TZ",
  "TL", "TO", "TT", "TV", "UG", "VU", "YE", "ZW",
]);

// Market-specific wording. `subdivision` names the state/province field,
// `postal` names the postal-code field.
const LABELS = {
  AE: { subdivision: "Emirate", postal: "PO Box" },
  IN: { subdivision: "State", postal: "PIN code" },
  US: { subdivision: "State", postal: "ZIP code" },
  CA: { subdivision: "Province", postal: "Postal code" },
  GB: { subdivision: "County", postal: "Postcode" },
  SA: { subdivision: "Region", postal: "Postal code" },
};

const DEFAULT_LABELS = { subdivision: "State / Province", postal: "Postal / ZIP code" };

/** False only for countries with no postal-code system — see NO_POSTAL_CODE. */
export function countryUsesPostalCode(code) {
  return !NO_POSTAL_CODE.has(String(code || "").toUpperCase());
}

/** What to call the state/province field in this country. */
export function subdivisionLabel(code) {
  return LABELS[String(code || "").toUpperCase()]?.subdivision ?? DEFAULT_LABELS.subdivision;
}

/**
 * What to call the postal-code field in this country. Callers append their own
 * "*" / "(optional)" based on countryUsesPostalCode().
 */
export function postalCodeLabel(code) {
  return LABELS[String(code || "").toUpperCase()]?.postal ?? DEFAULT_LABELS.postal;
}
