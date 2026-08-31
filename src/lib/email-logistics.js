/**
 * The dispatch handoff to the external courier desk.
 *
 * Delivery is not run from this codebase. An outside courier service (SkyCom
 * Express) carries every parcel, and the logistics team works out of a shared
 * mailbox — they sign in, read the dispatch email, book the consignment from
 * the address it carries, and send the AWB (Air Waybill) number straight to the
 * customer, by email or SMS as they see fit. So this file has one job: put
 * everything the courier desk needs to fill in a booking form into one email, in
 * the order their form asks for it.
 *
 * Two things separate these senders from the ones in lib/email-orders.js.
 *
 * 1. They are not optional. Every other order email is a courtesy — losing one
 *    costs a notification. Losing this one means a paid order that nobody was
 *    ever told to ship, and nothing downstream would notice, because the order
 *    looks perfectly healthy from every other angle. So a successful send is
 *    stamped on Order.logisticsNotifiedAt and the admin order list flags any
 *    paid order still missing it.
 *
 * 2. They are addressed to staff, not to customers. Nothing here is marketing
 *    copy: the address is broken back out into labelled fields rather than
 *    rendered as the prose block formatAddress() produces, because somebody is
 *    retyping it into a courier's system field by field.
 */

import { prisma } from "@/lib/prisma";
import {
  escapeHtml,
  formatMoney,
  getBrandContext,
  renderEmailLayout,
  sendEmail,
} from "@/lib/email";

/**
 * The shared courier-desk mailbox. Falls back to the store's own order alerts
 * inbox rather than to nothing: a dispatch instruction sitting in the admin's
 * inbox is recoverable, one that was never sent is not.
 */
function logisticsRecipient() {
  return (
    process.env.LOGISTICS_EMAIL ||
    process.env.ORDER_NOTIFICATION_EMAIL ||
    process.env.EMAIL_REPLY_TO ||
    null
  );
}

const ORDER_FOR_DISPATCH = {
  items: true,
  user: { select: { name: true, email: true, phone: true } },
};

/**
 * The dispatch email additionally pulls one photo per line, as a picking aid:
 * somebody has to take the right jar off the shelf, and a name like "Triphala
 * Churna 250 g" next to three near-identical tubs is how the wrong one gets
 * boxed.
 *
 * VIDEO rows share this table and are filtered out — the gallery on the product
 * page mixes both, and an email cannot show a video. `sortOrder` picks the same
 * primary shot the storefront leads with, so the picker is looking at the
 * packaging the customer saw.
 *
 * Read live from the catalogue rather than snapshotted onto OrderItem at
 * checkout. That is the right way round for this purpose: if the packaging has
 * been rephotographed since the order, the picker wants the tub currently on
 * the shelf, not the one that was there last month.
 */
const ORDER_FOR_DISPATCH_EMAIL = {
  items: {
    include: {
      product: {
        select: {
          images: {
            where: { mediaType: "IMAGE" },
            orderBy: { sortOrder: "asc" },
            take: 1,
            select: { url: true, altText: true },
          },
        },
      },
    },
  },
  user: { select: { name: true, email: true, phone: true } },
};

const value = (v) => String(v ?? "").trim();

/**
 * The delivery block, field by field, in the order a UAE courier's booking
 * form asks for them.
 *
 * Reads the address snapshot directly instead of going through
 * formatAddressLines(): that function deliberately merges fields for display
 * ("Villa 12, Al Barsha Gardens" on one line), which is right for a customer
 * reading their confirmation and wrong for somebody transcribing into separate
 * form inputs.
 *
 * The labels are the checkout form's own labels, verbatim — "Full Name", not
 * "Consignee"; "Whatsapp Number", not "WhatsApp". Only the ordering differs.
 * When the desk queries an address, the shop pulls the order up on the same
 * form the customer filled in, and a field named two different ways in the two
 * places is a field the two of them can talk past each other about. Keep these
 * in step with REQUIRED_ADDRESS_FIELDS in lib/address.js.
 *
 * Legacy snapshots — the line1/line2/city/state shape used before
 * the UAE address format — are handled with their own labels so an old order
 * that somehow reaches this path still produces a usable instruction.
 *
 * @param {object|null} snapshot
 * @returns {Array<[string, string]>} label/value pairs, blanks stripped
 */
function deliveryFields(snapshot) {
  const s = snapshot ?? {};
  const isLegacy = !s.building && !s.area && !s.emirate;

  const rows = isLegacy
    ? [
        ["Full Name", s.fullName],
        ["Address line 1", s.line1],
        ["Address line 2", s.line2],
        ["City", s.city],
        ["State", s.state],
        ["Postal code", s.postalCode],
        ["Country", s.country],
        ["Mobile", s.phone],
        ["Email", s.email],
      ]
    : [
        ["Full Name", s.fullName],
        ["Mobile Number (1)", s.phone],
        // The one optional field on the form, and the only row here that is
        // printed even when empty: a blank line reads as "there is no second
        // number", while a missing one reads as a field somebody forgot to
        // copy across — and the desk would ring the shop to ask which it was.
        ["Mobile Number (2)", value(s.phone2) || "N/A"],
        ["Whatsapp Number", s.whatsapp],
        // One of the two places the AWB can go — the desk chooses between this
        // and the mobile above. Both are called out again in the copy, because
        // sending the number back is the whole reason they need either field.
        ["E mail", s.email],
        ["Apartment / Villa / Office Number", s.unit],
        ["Building Name / Tower / Villa Community", s.building],
        ["Sub-Cluster / Phase / Street Name", s.street],
        ["Area / District", s.area],
        ["Emirate / City", s.emirate],
        ["Nearest Landmark", s.landmark],
        ["Country", s.country],
      ];

  return rows.map(([label, v]) => [label, value(v)]).filter(([, v]) => v);
}

/**
 * A left-aligned label/value table.
 *
 * renderInfoRows() from lib/email.js right-aligns its values in bold, which
 * suits a short "Order total: AED 120" row and reads badly for a column of long
 * address strings — they wrap away from their labels. Same visual family, laid
 * out for transcription instead.
 *
 * The labels wrap rather than hold one line: they are the checkout form's, and
 * "Building Name / Tower / Villa Community" on one unbreakable line pushes the
 * table wider than a phone screen. The fixed label column keeps the values
 * starting at the same x whichever rows wrap.
 */
function renderFieldTable(rows) {
  const body = rows
    .map(
      ([label, v]) =>
        `<tr>
          <td width="45%" style="padding:7px 12px 7px 0;font-size:13px;color:#64748b;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:7px 0;font-size:14px;color:#0f172a;font-weight:bold;">${escapeHtml(v)}</td>
        </tr>`
    )
    .join("\n");

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 16px;margin:0 0 24px;">
${body}
</table>`;
}

/** The same rows as plain text, padded so the labels line up when pasted. */
function fieldsToText(rows) {
  const width = Math.max(0, ...rows.map(([label]) => label.length));
  return rows.map(([label, v]) => `${label.padEnd(width)}  ${v}`).join("\n");
}

/** A coloured callout — used for the facts a courier must not miss. */
function renderNotice(text, { tone = "warn" } = {}) {
  const palette =
    tone === "danger"
      ? { bg: "#fef2f2", border: "#fecaca", fg: "#991b1b" }
      : { bg: "#fffbeb", border: "#fde68a", fg: "#92400e" };

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${palette.bg};border:1px solid ${palette.border};border-radius:8px;margin:0 0 24px;">
  <tr><td style="padding:14px 16px;font-size:14px;line-height:1.5;color:${palette.fg};font-weight:bold;">${escapeHtml(text)}</td></tr>
</table>`;
}

/**
 * Make an image src usable inside an email.
 *
 * The R2 driver already stores absolute URLs, but the local-disk driver stores
 * "/uploads/..." — and a relative src in an email is a broken image everywhere,
 * because there is no page origin to resolve it against.
 */
function absoluteUrl(url, siteUrl) {
  const raw = value(url);
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${siteUrl}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function heading(text) {
  return `                <p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${escapeHtml(text)}</p>`;
}

function paragraph(text) {
  return `                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(text)}</p>`;
}

function subheading(text) {
  return `                <p style="margin:0 0 8px;font-size:14px;font-weight:bold;">${escapeHtml(text)}</p>`;
}

// Every order placed through the current checkout is paid in full on Stripe
// before it is ever handed over, so this is unconditional — but it is stated on
// every single dispatch instruction rather than assumed, because a courier
// booking a parcel as COD by default would have the customer asked at the door
// for money they have already paid.
const PREPAID_NOTICE =
  "PREPAID — this order is paid in full. Do NOT collect any cash on delivery.";

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Sends the courier desk everything it needs to book one consignment.
 *
 * Called from confirmPaidOrder() once the money has actually cleared. Never at
 * order creation: an unpaid order is a stock reservation, and shipping goods
 * against an abandoned Stripe session is the one mistake here that costs real
 * inventory.
 *
 * Safe to call more than once. The stamped `logisticsNotifiedAt` is checked
 * first, so a retry, a duplicated webhook or an admin pressing resend on an
 * order that did go out cannot produce a second parcel — pass `force` to
 * override that, which is what the admin resend endpoint does when a first
 * attempt failed and the timestamp was therefore never written.
 *
 * @param {string} orderId
 * @param {{force?: boolean}} [options]
 * @returns {Promise<{status: "sent"|"failed"|"skipped"|"not_found"|"no_recipient"}>}
 */
export async function sendLogisticsDispatchEmail(orderId, { force = false } = {}) {
  const to = logisticsRecipient();
  if (!to) {
    // Loud, because the failure is silent everywhere else: orders keep being
    // paid for and nothing is ever dispatched.
    console.error(
      "[logistics] No dispatch recipient configured — set LOGISTICS_EMAIL. " +
        `Order ${orderId} has NOT been sent for shipping.`
    );
    return { status: "no_recipient" };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_FOR_DISPATCH_EMAIL,
  });
  if (!order) return { status: "not_found" };
  if (order.logisticsNotifiedAt && !force) return { status: "skipped" };

  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const address = order.addressSnapshot;
  const fields = deliveryFields(address);
  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const summary = [
    ["Order number", order.orderNumber],
    ["Order date", new Date(order.createdAt).toDateString()],
    ["Pieces", String(pieces)],
    ["Declared value", formatMoney(order.total)],
    ["Payment", "Paid online (prepaid)"],
  ];

  // Contents, described for a waybill rather than priced for a customer: the
  // courier needs to know what is in the box and how many, not what each line
  // cost. The declared value above is the figure that goes on the consignment.
  const contents = order.items
    .map((item) => {
      const photo = absoluteUrl(item.product?.images?.[0]?.url, siteUrl);
      // A fixed-size cell whether or not there is a photo, so the name column
      // stays on one vertical line down the table. Width and height are set as
      // HTML attributes as well as CSS: Outlook ignores the stylesheet and
      // would otherwise render the image at its natural size.
      const thumb = photo
        ? `<img src="${escapeHtml(photo)}" width="56" height="56" alt="${escapeHtml(item.productName)}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0;display:block;" />`
        : `<span style="display:block;width:56px;height:56px;border-radius:6px;border:1px dashed #cbd5e1;"></span>`;

      return `<tr>
          <td width="56" style="padding:8px 12px 8px 0;border-bottom:1px solid #e2e8f0;vertical-align:top;">${thumb}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;vertical-align:top;">${escapeHtml(item.productName)}</td>
          <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:right;white-space:nowrap;vertical-align:top;">x${escapeHtml(item.quantity)}</td>
        </tr>`;
    })
    .join("\n");

  // Where the AWB goes back to. Both channels, because which one the desk uses
  // is their call — some couriers SMS the number, some mail it — and the copy
  // must not promise the customer one and then arrive by the other.
  //
  // The snapshot wins over the account's contact details: a gift sent to a
  // relative is addressed to the relative, and the AWB has to follow the parcel,
  // not the buyer.
  const customerEmail = value(address?.email) || value(order.user?.email);
  const customerPhone = value(address?.phone) || value(order.user?.phone);
  const awbContacts = [
    customerEmail ? `email ${customerEmail}` : null,
    customerPhone ? `mobile ${customerPhone}` : null,
  ]
    .filter(Boolean)
    .join(" or ");

  const bodyHtml = [
    heading(`Dispatch request — ${order.orderNumber}`),
    paragraph(
      "This order is paid and ready to ship. Please book it with the courier and send the AWB number to the customer by email or SMS."
    ),
    renderNotice(PREPAID_NOTICE),
    subheading("Consignment"),
    renderFieldTable(summary),
    subheading("Deliver to"),
    renderFieldTable(fields),
    subheading("Contents"),
    `                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">\n${contents}\n</table>`,
    awbContacts ? renderNotice(`Send the AWB number to the customer on ${awbContacts}.`) : "",
    paragraph(`Quote order ${order.orderNumber} in any correspondence about this parcel.`),
  ]
    .filter(Boolean)
    .join("\n");

  const text = `DISPATCH REQUEST — ${order.orderNumber}

${PREPAID_NOTICE}

CONSIGNMENT
${fieldsToText(summary)}

DELIVER TO
${fieldsToText(fields)}

CONTENTS
${order.items.map((item) => `  - ${item.productName} x${item.quantity}`).join("\n")}

Send the AWB number to the customer by email or SMS${awbContacts ? ` — ${awbContacts}` : ""}.
Quote order ${order.orderNumber} in any correspondence.

${siteUrl}/admin/orders`;

  const result = await sendEmail({
    to,
    // Replies go to the store, not to the no-reply sender: the courier desk
    // asking "which tower is this?" has to reach somebody.
    replyTo: supportEmail,
    template: "logistics_dispatch",
    orderId: order.id,
    subject: `Dispatch ${order.orderNumber} — ${value(address?.emirate) || "UAE"} — PREPAID`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text,
  });

  // Stamped only on a confirmed send. sendEmail() never throws — it returns
  // ok:false and logs — so this check is the only thing standing between a
  // bounced dispatch and an order that quietly never ships.
  if (!result?.ok) {
    console.error(
      `[logistics] Dispatch email FAILED for ${order.orderNumber}. ` +
        "Nobody has been told to ship it — resend it from /admin/orders."
    );
    return { status: "failed" };
  }

  await prisma.order.update({
    where: { id: order.id },
    data: { logisticsNotifiedAt: new Date() },
  });

  return { status: "sent" };
}

// ---------------------------------------------------------------------------
// Stop the parcel
// ---------------------------------------------------------------------------

/**
 * Tells the courier desk to pull an order that has already been handed to them.
 *
 * Only meaningful for an order they were told about: cancelling something that
 * never reached them is nothing to email anybody about, so an order with no
 * `logisticsNotifiedAt` is skipped. Without this, cancelOrder() would refund
 * the customer while the courier still has a live booking against their name.
 *
 * @param {string} orderId
 * @returns {Promise<{status: "sent"|"skipped"|"not_found"|"no_recipient"}>}
 */
export async function sendLogisticsCancelEmail(orderId) {
  const to = logisticsRecipient();
  if (!to) return { status: "no_recipient" };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_FOR_DISPATCH,
  });
  if (!order) return { status: "not_found" };
  if (!order.logisticsNotifiedAt) return { status: "skipped" };

  const { brand, supportEmail } = await getBrandContext();
  const address = order.addressSnapshot;

  const rows = [
    ["Order number", order.orderNumber],
    ["Full Name", value(address?.fullName)],
    ["Area / Emirate", [value(address?.area), value(address?.emirate)].filter(Boolean).join(", ")],
    ["Dispatched to you", new Date(order.logisticsNotifiedAt).toDateString()],
    order.trackingNumber ? ["AWB number", order.trackingNumber] : null,
  ]
    .filter(Boolean)
    .map(([label, v]) => [label, value(v)])
    .filter(([, v]) => v);

  const bodyHtml = [
    heading(`Cancel dispatch — ${order.orderNumber}`),
    renderNotice(
      "This order has been cancelled. Please do not ship it. If it has already been collected, recall the parcel.",
      { tone: "danger" }
    ),
    renderFieldTable(rows),
    paragraph(
      order.cancelReason
        ? `Reason given: ${order.cancelReason}`
        : "Please confirm once the booking is cancelled."
    ),
  ].join("\n");

  await sendEmail({
    to,
    replyTo: supportEmail,
    template: "logistics_cancel",
    orderId: order.id,
    subject: `CANCELLED — do not ship ${order.orderNumber}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `CANCEL DISPATCH — ${order.orderNumber}

This order has been cancelled. Do not ship it. If it has already been collected, recall the parcel.

${fieldsToText(rows)}

${order.cancelReason ? `Reason: ${order.cancelReason}` : "Please confirm once the booking is cancelled."}`,
  });

  return { status: "sent" };
}
