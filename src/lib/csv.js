/**
 * CSV serialisation.
 *
 * Deliberately generic — it knows about rows and columns, not about orders or
 * addresses. Every export in the admin console should build its column list and
 * hand it to toCsv() rather than assembling delimited strings by hand, because
 * the two things that go wrong with hand-rolled CSV (quoting and Excel) are
 * both solved once here.
 */

/**
 * Byte-order mark.
 *
 * Excel on Windows opens a .csv as the system codepage unless the file starts
 * with a UTF-8 BOM, which turns Arabic names, "×" and the dirham sign into
 * mojibake. Every browser and every other spreadsheet tolerates the BOM, so it
 * is always written. Built from its code point rather than typed as a literal,
 * because the character is invisible in source and an editor, a formatter or a
 * copy-paste would silently drop it with nothing to see in the diff.
 */
export const CSV_BOM = String.fromCharCode(0xfeff);

// Cells a spreadsheet would execute rather than show as text. A customer can
// type "=cmd|'/c calc'!A0" or "@SUM(...)" into a checkout field, and an admin
// opening the export must see those characters back rather than a formula, a
// #NAME? error, or a prompt about an external data source.
//
// OWASP also lists "+" and "-" as injection prefixes, and they are deliberately
// NOT guarded here: every UAE mobile number in this data starts with "+", so
// guarding them would put a stray apostrophe in front of every phone number in
// every export — visible in a spreadsheet and, worse, part of the value for any
// program parsing the file, such as a courier's bulk-upload importer. Corrupting
// every phone number to defend against a prefix that cannot by itself execute
// anything is the wrong trade. Excel will render a bare "+971..." as a number
// and drop the plus; the full value is always available in the "Full Address"
// column, which cannot begin with one of these characters.
const FORMULA_PREFIX = /^[=@\t\r]/;

/**
 * Render one value as a CSV field.
 *
 * @param {unknown} value
 * @returns {string}
 */
function escapeCell(value) {
  if (value === null || value === undefined) return "";

  let text = value instanceof Date ? value.toISOString() : String(value);

  // Neutralise a leading formula character by prefixing an apostrophe, which
  // spreadsheets consume as "treat the rest as text".
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;

  // RFC 4180: wrap in quotes when the field contains a delimiter, a quote or a
  // newline, and double any quote inside it.
  if (/[",\r\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;

  return text;
}

/**
 * Build a complete CSV document.
 *
 * @param {object[]} rows     one object per line, keyed by column key
 * @param {[string, string][]} columns  [key, header] pairs, in output order —
 *   the same shape REQUIRED_ADDRESS_FIELDS uses, so a field list can be reused
 *   as a column list without translation
 * @returns {string} CSV text including the BOM, CRLF line endings
 */
export function toCsv(rows, columns) {
  const lines = [columns.map(([, header]) => escapeCell(header)).join(",")];

  for (const row of rows) {
    lines.push(columns.map(([key]) => escapeCell(row?.[key])).join(","));
  }

  // CRLF is what RFC 4180 specifies and what Excel expects; everything else
  // reads it fine.
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

/**
 * Wrap CSV text in a downloadable Response.
 *
 * @param {string} csv       output of toCsv()
 * @param {string} filename  suggested name, e.g. "orders-2026-08-29.csv"
 * @returns {Response}
 */
export function csvResponse(csv, filename) {
  // Quoted so a filename containing a space or comma survives the header, and
  // stripped of the characters that would let one break out of the quotes.
  const safeName = filename.replace(/["\\\r\n]/g, "") || "export.csv";

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      // An export is a snapshot of live data — never let a proxy or the browser
      // hand back yesterday's file.
      "Cache-Control": "no-store",
    },
  });
}
