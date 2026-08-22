// The shipping address: its field set, its validation, and how it renders.
//
// UAE addresses are not street-and-postcode addresses. There is no national
// postal code, and a courier finds a parcel by emirate → area → building or
// villa community → apartment/villa number → nearest landmark. The fields below
// mirror exactly that, which is why they don't look like the generic
// line1 / line2 / city / state / ZIP form they replace.
//
// Orders placed before this change still hold the old snapshot shape in
// `Order.addressSnapshot`, and their invoices, emails and order history must
// keep rendering. Nothing here rewrites stored snapshots — the readers simply
// recognise both shapes. See LEGACY handling in formatAddressLines().

import { validateEmail, validatePhone } from "@/lib/validation";

/**
 * Fields that must be filled for an order to be deliverable, with the exact
 * label the checkout form shows, so the client and the API can never disagree
 * about what is required or name the same field two different ways.
 */
export const REQUIRED_ADDRESS_FIELDS = [
  ["fullName", "Full Name"],
  ["emirate", "Emirate / City"],
  ["area", "Area / District"],
  ["phone", "Mobile Number (1)"],
  ["building", "Building Name / Tower / Villa Community"],
  ["street", "Sub-Cluster / Phase / Street Name"],
  ["unit", "Apartment / Villa / Office Number"],
  ["landmark", "Nearest Landmark"],
  ["country", "Country"],
  ["email", "E mail"],
  ["whatsapp", "Whatsapp Number"],
];

const value = (v) => String(v ?? "").trim();

/**
 * Validate a shipping address snapshot.
 *
 * Runs on the client before the order is submitted and again in the order API,
 * so a hand-crafted request can't store an address nobody can deliver to.
 *
 * @param {object} snapshot  address in the shape buildShippingAddress() produces
 * @returns {string|null} the first problem found, or null when the address is good
 */
export function validateShippingAddress(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return "Please enter your shipping address.";
  }

  for (const [field, label] of REQUIRED_ADDRESS_FIELDS) {
    if (!value(snapshot[field])) return `Please enter your ${label}.`;
  }

  // The courier needs a number that can actually be dialled to arrange the
  // delivery and collect the cash.
  const phoneError = validatePhone(snapshot.phone, { required: true });
  if (phoneError) return phoneError;

  // WhatsApp is how the shop confirms and follows up on a delivery, so it is
  // required — the loop above has already caught a blank one, leaving only the
  // shape to check here. The spare mobile is the one optional number, but if
  // one was typed it still has to be usable: a wrong number is worse than none.
  const whatsappError = validatePhone(snapshot.whatsapp, { required: true });
  if (whatsappError) return whatsappError;
  const phone2Error = validatePhone(snapshot.phone2);
  if (phone2Error) return phone2Error;

  return validateEmail(snapshot.email);
}

/**
 * Flatten an address snapshot into display lines — one array, used by the
 * invoice PDF, the order emails and the customer's order history so all three
 * print the same address the same way.
 *
 * @param {object|null} snapshot
 * @returns {string[]} lines, already stripped of anything blank
 */
export function formatAddressLines(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const s = snapshot;
  const join = (...parts) => parts.map(value).filter(Boolean).join(", ");

  // Snapshots written before the UAE format carry line1/line2/city/state/
  // postalCode and none of the fields below. Render those as they always were.
  const isLegacy = !s.building && !s.area && !s.emirate;
  if (isLegacy) {
    return [
      value(s.fullName),
      value(s.line1),
      value(s.line2),
      join(s.city, s.state),
      [value(s.postalCode), value(s.country)].filter(Boolean).join(" "),
      value(s.phone) && `Phone: ${value(s.phone)}`,
    ].filter(Boolean);
  }

  const mobiles = [value(s.phone), value(s.phone2)].filter(Boolean).join(" / ");

  return [
    value(s.fullName),
    join(s.unit, s.building),
    value(s.street),
    join(s.area, s.emirate),
    value(s.landmark) && `Near ${value(s.landmark)}`,
    value(s.country),
    mobiles && `Mobile: ${mobiles}`,
    value(s.whatsapp) && `WhatsApp: ${value(s.whatsapp)}`,
    value(s.email) && `Email: ${value(s.email)}`,
  ].filter(Boolean);
}

/** The same lines as one newline-separated block, for plain-text contexts. */
export function formatAddress(snapshot) {
  const lines = formatAddressLines(snapshot);
  return lines.length > 0 ? lines.join("\n") : null;
}

/**
 * A one-line summary — "Villa 12, Al Barsha Gardens, Al Barsha, Dubai" — for
 * the order-placed confirmation, where the full block would crowd the screen.
 */
export function formatAddressSummary(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return "";
  return [snapshot.unit, snapshot.building, snapshot.area, snapshot.emirate]
    .map(value)
    .filter(Boolean)
    .join(", ");
}
