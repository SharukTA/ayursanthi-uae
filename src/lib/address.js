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
 * True for a snapshot written before the UAE format — those carry
 * line1/line2/city/state/postalCode and none of the fields above.
 *
 * Detection is by absence rather than by a stored version marker because the
 * old snapshots were written without one and cannot be retro-stamped. Any
 * snapshot missing all three of the UAE locality fields predates the change.
 */
export function isLegacySnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return false;
  return !snapshot.building && !snapshot.area && !snapshot.emirate;
}

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
  // delivery.
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
/**
 * Just the postal half — who it is for and where it is — with no phone numbers
 * or email addresses.
 *
 * Split out for screens that render the contact channels themselves, as
 * something clickable rather than as text: the gift winners table turns every
 * number into a `tel:` link, and printing them again inside the address block
 * underneath would show the same number twice and read as two contacts. Every
 * other caller wants the whole thing and goes on using formatAddressLines(),
 * which is now this plus those channels — one definition of the order, so the
 * two can never drift apart.
 *
 * @param {object|null} snapshot
 * @returns {string[]}
 */
export function formatPostalLines(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const s = snapshot;
  const join = (...parts) => parts.map(value).filter(Boolean).join(", ");

  if (isLegacySnapshot(s)) {
    return [
      value(s.fullName),
      value(s.line1),
      value(s.line2),
      join(s.city, s.state),
      [value(s.postalCode), value(s.country)].filter(Boolean).join(" "),
    ].filter(Boolean);
  }

  return [
    value(s.fullName),
    join(s.unit, s.building),
    value(s.street),
    join(s.area, s.emirate),
    value(s.landmark) && `Near ${value(s.landmark)}`,
    value(s.country),
  ].filter(Boolean);
}

export function formatAddressLines(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return [];
  const s = snapshot;
  const postal = formatPostalLines(s);

  if (isLegacySnapshot(s)) {
    return [...postal, value(s.phone) && `Phone: ${value(s.phone)}`].filter(Boolean);
  }

  const mobiles = [value(s.phone), value(s.phone2)].filter(Boolean).join(" / ");

  return [
    ...postal,
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

/**
 * The address as spreadsheet columns: [key, header] pairs in the order they
 * should appear, matching the shape REQUIRED_ADDRESS_FIELDS uses so a field
 * list and a column list stay interchangeable.
 *
 * Every piece of the address gets its own column rather than one pre-joined
 * string, because the point of an export is to be sorted, filtered and pasted
 * into whatever template a courier or an accountant hands over. `addressBlock`
 * at the end is the same address rendered the way the invoice and the courier
 * email render it — redundant for a UAE-format row, and the only complete
 * record for a legacy one (see flattenAddressSnapshot).
 */
export const ADDRESS_EXPORT_COLUMNS = [
  ["fullName", "Full Name"],
  ["emirate", "Emirate / City"],
  ["area", "Area / District"],
  ["building", "Building / Tower / Villa Community"],
  ["street", "Sub-Cluster / Phase / Street"],
  ["unit", "Apartment / Villa / Office No."],
  ["landmark", "Nearest Landmark"],
  ["country", "Country"],
  ["countryCode", "Country Code"],
  ["phone", "Mobile 1"],
  ["phone2", "Mobile 2"],
  ["whatsapp", "WhatsApp"],
  ["email", "Shipping Email"],
  ["addressBlock", "Full Address"],
];

/**
 * Flatten an address snapshot to the exact key set in ADDRESS_EXPORT_COLUMNS,
 * whichever shape it was stored in.
 *
 * This is what keeps the export stable while the address format changes. A
 * consumer gets the same columns for every order ever placed; only the fill
 * varies. Legacy snapshots are mapped into the closest UAE slot — city becomes
 * the emirate, line1 the building, line2 the street — which is approximate on
 * purpose, and why `addressBlock` carries the address verbatim alongside:
 * it is the only complete record of a legacy row, including the postal code
 * that has no column of its own because the UAE has no postal codes.
 *
 * @param {object|null} snapshot  an Order.addressSnapshot
 * @returns {Record<string, string>} every ADDRESS_EXPORT_COLUMNS key, always set
 */
export function flattenAddressSnapshot(snapshot) {
  const blank = Object.fromEntries(ADDRESS_EXPORT_COLUMNS.map(([key]) => [key, ""]));

  if (!snapshot || typeof snapshot !== "object") return blank;

  const s = snapshot;
  const block = formatAddressLines(s).join(" | ");

  if (isLegacySnapshot(s)) {
    return {
      ...blank,
      fullName: value(s.fullName),
      emirate: value(s.city),
      area: value(s.state),
      building: value(s.line1),
      street: value(s.line2),
      country: value(s.country),
      phone: value(s.phone),
      addressBlock: block,
    };
  }

  return {
    fullName: value(s.fullName),
    emirate: value(s.emirate),
    area: value(s.area),
    building: value(s.building),
    street: value(s.street),
    unit: value(s.unit),
    landmark: value(s.landmark),
    country: value(s.country),
    countryCode: value(s.countryCode),
    phone: value(s.phone),
    phone2: value(s.phone2),
    whatsapp: value(s.whatsapp),
    email: value(s.email),
    addressBlock: block,
  };
}
