/**
 * Order lifecycle emails.
 *
 * Every sender here takes an id and loads what it needs itself, so the call
 * sites in the routes and in lib/order-actions.js stay one-liners and no
 * caller has to remember which relations a template reads.
 *
 * All of these are non-critical: a delivery failure is logged inside
 * sendEmail() and never propagates. Wrap calls in queueEmail() so the send
 * survives the serverless runtime freezing after the response is flushed.
 *
 * Volume note: the customer gets exactly two, and only ever two — the order
 * confirmation when payment clears, and a cancellation notice if it comes to
 * that. There is no per-step fulfilment mail because there are no fulfilment
 * steps to report: the courier takes the parcel the moment the money is in and
 * the AWB number on their side is the record of where it went.
 */

import { prisma } from "@/lib/prisma";
import { paymentMethodLabel } from "@/lib/order-policy";
import { formatStoreDate } from "@/lib/store-time";
import { formatAddress } from "@/lib/address";
import {
  adminRecipient,
  escapeHtml,
  formatMoney,
  getBrandContext,
  itemsToText,
  renderButton,
  renderEmailLayout,
  renderInfoRows,
  renderItemsTable,
  sendEmail,
} from "@/lib/email";
import { renderOrderInvoice } from "@/lib/invoice";

function firstName(name) {
  return (name || "there").trim().split(/\s+/)[0];
}

/** Standard greeting + paragraph block, escaped. */
function paragraphs(...lines) {
  return lines
    .filter(Boolean)
    .map(
      (line) =>
        `                <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${escapeHtml(line)}</p>`
    )
    .join("\n");
}

function heading(text) {
  return `                <p style="margin:0 0 16px;font-size:16px;font-weight:bold;">${escapeHtml(text)}</p>`;
}

const ORDER_FOR_EMAIL = {
  items: true,
  user: { select: { name: true, email: true } },
  // Tells a card order from a cash one, which changes what these emails say
  // about paying — see paymentMethodLabel() in lib/order-policy.js.
  payments: true,
};

/**
 * Who an order's customer-facing mail goes to.
 *
 * The account email first — it is the identity behind the order, it is the only
 * address that can sign in to act on the cancel and track links these mails
 * carry, and it cannot drift because the profile form does not allow changing
 * it (see api/user/profile/route.js).
 *
 * Then the email typed into the shipping form, when it is a different one. The
 * checkout seeds that field from the account address, so a difference means the
 * shopper deliberately edited it — using a work address for a delivery, or
 * ordering on someone else's behalf — and silently never writing to an address
 * they chose for this order is how a customer ends up believing no confirmation
 * was ever sent.
 *
 * Both go out as a single message, so this costs nothing against the sending
 * quota. sendEmail() drops the duplicate when the two match, which is the
 * common case.
 */
function orderRecipients(order) {
  return [order?.user?.email, order?.addressSnapshot?.email];
}

// ---------------------------------------------------------------------------
// Order placed
// ---------------------------------------------------------------------------

/**
 * Confirms a paid order to the customer.
 *
 * Sent once the payment has actually cleared, never at order creation — an
 * unpaid order is a reservation, not something to congratulate anybody on.
 *
 * Carries the invoice. It used to ride along with the delivery email, but the
 * store no longer tracks a parcel to its door, and payment clearing is now the
 * moment the sale is complete on this side.
 *
 * @param {string} orderId
 */
export async function sendOrderPlacedEmail(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_FOR_EMAIL,
  });
  if (!order?.user?.email) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const address = formatAddress(order.addressSnapshot);

  // A PDF failure must not cost the customer the confirmation itself, so this
  // degrades to an unattached email rather than throwing. The invoice is always
  // downloadable from /dashboard/orders either way.
  let attachments;
  try {
    const invoice = await renderOrderInvoice(order.id);
    if (invoice) {
      attachments = [{ filename: invoice.filename, content: invoice.buffer }];
    }
  } catch (error) {
    console.error(
      `[email] invoice render failed for ${order.orderNumber}, sending without it:`,
      error?.message || error
    );
  }

  // Only promised when it is genuinely attached — see the catch above.
  const invoiceNote = attachments ? "Your invoice is attached." : null;

  const bodyHtml = [
    heading(`Hi ${firstName(order.user.name)},`),
    paragraphs(
      `Thank you for your order. We've received it and will start preparing it shortly.`,
      `We've received your payment of ${formatMoney(order.total)} — there is nothing to pay when your parcel arrives.`,
      invoiceNote
    ),
    renderInfoRows([
      ["Order number", order.orderNumber],
      ["Order date", formatStoreDate(order.createdAt)],
      ["Payment", paymentMethodLabel(order)],
    ]),
    renderItemsTable(order.items, {
      subtotal: order.subtotal,
      shipping: order.shipping,
      total: order.total,
    }),
    address
      ? `                <p style="margin:0 0 8px;font-size:14px;font-weight:bold;">Delivering to</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(address).replace(/\n/g, "<br/>")}</p>`
      : "",
    renderButton(`${siteUrl}/dashboard/orders`, "View your order"),
  ].join("\n");

  const text = `Hi ${firstName(order.user.name)},

Thank you for your order. We've received it and will start preparing it shortly.${invoiceNote ? `\n\n${invoiceNote}` : ""}

Order number: ${order.orderNumber}
Payment: ${paymentMethodLabel(order)}

${itemsToText(order.items)}

Total: ${formatMoney(order.total)}

Paid in full — nothing further to pay.

View your order: ${siteUrl}/dashboard/orders`;

  await sendEmail({
    to: orderRecipients(order),
    template: "order_placed",
    orderId: order.id,
    subject: `Order confirmed — ${order.orderNumber}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text,
    attachments,
  });
}

/**
 * Alerts the store that a new order came in.
 * @param {string} orderId
 */
export async function sendNewOrderAdminEmail(orderId) {
  const to = adminRecipient();
  if (!to) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_FOR_EMAIL,
  });
  if (!order) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const address = formatAddress(order.addressSnapshot);

  const bodyHtml = [
    heading(`New order: ${order.orderNumber}`),
    renderInfoRows([
      ["Customer", order.user?.name || "—"],
      ["Email", order.user?.email || "—"],
      ["Total", formatMoney(order.total)],
      ["Payment", paymentMethodLabel(order)],
    ]),
    renderItemsTable(order.items, { total: order.total }),
    address
      ? `                <p style="margin:0 0 8px;font-size:14px;font-weight:bold;">Ship to</p>
                <p style="margin:0 0 24px;font-size:14px;line-height:1.6;color:#334155;">${escapeHtml(address).replace(/\n/g, "<br/>")}</p>`
      : "",
    renderButton(`${siteUrl}/admin/orders`, "Open in admin"),
  ].join("\n");

  await sendEmail({
    to,
    template: "admin_new_order",
    orderId: order.id,
    subject: `New order ${order.orderNumber} — ${formatMoney(order.total)}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `New order ${order.orderNumber}\nCustomer: ${order.user?.name} (${order.user?.email})\nTotal: ${formatMoney(order.total)}\n\n${itemsToText(order.items)}`,
  });
}

// ---------------------------------------------------------------------------
// Order cancelled
// ---------------------------------------------------------------------------

/**
 * Confirms a cancellation. Covers both the customer cancelling themselves and
 * the store cancelling on their behalf — the wording adapts to `cancelledBy`.
 *
 * @param {string} orderId
 */
export async function sendOrderCancelledEmail(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_FOR_EMAIL,
  });
  if (!order?.user?.email) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const byStore = order.cancelledBy === "ADMIN";
  const refunded = Number(order.refundedTotal ?? 0);

  const lead = byStore
    ? "We're sorry — we've had to cancel your order. Nothing further will be charged."
    : "Your order has been cancelled as requested.";

  const money =
    refunded > 0
      ? `A refund of ${formatMoney(refunded)} has been issued and should reach you within 3-5 business days.`
      : "Nothing was collected for this order, so there is nothing to refund.";

  const bodyHtml = [
    heading(`Hi ${firstName(order.user.name)},`),
    paragraphs(lead, money),
    renderInfoRows(
      [
        ["Order number", order.orderNumber],
        ["Cancelled on", formatStoreDate(order.cancelledAt ?? Date.now())],
        order.cancelReason ? ["Reason", order.cancelReason] : null,
        refunded > 0 ? ["Refunded", formatMoney(refunded)] : null,
      ].filter(Boolean)
    ),
    renderItemsTable(order.items),
    renderButton(`${siteUrl}/products`, "Continue shopping"),
  ].join("\n");

  await sendEmail({
    to: orderRecipients(order),
    template: "order_cancelled",
    orderId: order.id,
    subject: `Order ${order.orderNumber} cancelled`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `Hi ${firstName(order.user.name)},\n\n${lead}\n\n${money}\n\nOrder: ${order.orderNumber}${order.cancelReason ? `\nReason: ${order.cancelReason}` : ""}`,
  });
}
