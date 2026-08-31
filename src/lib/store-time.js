/**
 * Dates as the store reckons them.
 *
 * The store trades in the UAE, so every date it PRINTS is a fact about the
 * Gulf day, not about the machine that rendered it. That distinction only bites
 * on the server: Vercel's runtime is UTC, so a bare toDateString() on an order
 * placed at 01:30 in Dubai stamps it with the previous day — an invoice dated
 * the 30th for an order the customer placed on the 31st, which is exactly the
 * discrepancy that surfaces in a dispute.
 *
 * Note that `en-AE` alone does not fix this. The locale settles the SHAPE of
 * the output (day before month, English month names); the zone has to be named
 * separately, and omitting it silently falls back to the runtime's own.
 *
 * Asia/Dubai is written as an IANA zone here rather than the fixed +4 offset
 * that lib/gift-shared.js uses. Both are correct — GST has never observed
 * daylight saving — but these are formatters, where a zone name is the plainer
 * way to say it; the offset constant exists there because that module does
 * arithmetic on instants and needs a number.
 *
 * Two modules keep their own Dubai-pinned formatters rather than importing
 * these: lib/order-policy.js, which is deliberately dependency-free so the
 * customer UI can run the same checks the API enforces, and lib/gift-shared.js,
 * whose draw formatters are part of that module's own vocabulary. This one is
 * for the documents — invoices, emails, PDFs — that are rendered on the server
 * and read long after the fact.
 */

export const STORE_TIME_ZONE = "Asia/Dubai";
export const STORE_LOCALE = "en-AE";

/**
 * "31 August 2026" — for anything that dates a document.
 *
 * Empty string for anything undateable. null is rejected explicitly because
 * new Date(null) is epoch 0, a perfectly valid date — so an absent timestamp
 * would otherwise print "1 January 1970" on an invoice rather than nothing.
 */
export function formatStoreDate(value) {
  if (value == null || value === "") return "";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return at.toLocaleDateString(STORE_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: STORE_TIME_ZONE,
  });
}

/**
 * "31 August 2026 at 1:30 AM" — the same day with the hour, for the places
 * where the time of day is itself the point.
 */
export function formatStoreDateTime(value) {
  if (value == null || value === "") return "";
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  return `${formatStoreDate(at)} at ${at.toLocaleTimeString(STORE_LOCALE, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: STORE_TIME_ZONE,
  })}`;
}
