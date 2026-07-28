/**
 * Order and return lifecycle emails.
 *
 * Every sender here takes an id and loads what it needs itself, so the call
 * sites in the routes and in lib/order-actions.js stay one-liners and no
 * caller has to remember which relations a template reads.
 *
 * All of these are non-critical: a delivery failure is logged inside
 * sendEmail() and never propagates. Wrap calls in queueEmail() so the send
 * survives the serverless runtime freezing after the response is flushed.
 *
 * Volume note: the customer-facing set is placed, shipped, out for delivery and
 * delivered — ~4 sends per order. That is the knob to turn first if the provider
 * quota ever gets tight: drop OUT_FOR_DELIVERY from CORE_STATUS_EMAILS into
 * VERBOSE_STATUS_EMAILS and the tracker still shows the step, it just stops
 * mailing about it. Set EMAIL_NOTIFY_ALL_STATUSES=true to also mail on CONFIRMED
 * and PROCESSING (~6 sends).
 */

import { prisma } from "@/lib/prisma";
import {
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
import { RETURN_STATUS_COPY, returnReasonLabel } from "@/lib/returns";

/** Statuses that always mail the customer. */
const CORE_STATUS_EMAILS = ["SHIPPED", "OUT_FOR_DELIVERY", "DELIVERED"];
/** Extra statuses, only when the store opts in. */
const VERBOSE_STATUS_EMAILS = ["CONFIRMED", "PROCESSING"];

function notifiableStatuses() {
  return process.env.EMAIL_NOTIFY_ALL_STATUSES === "true"
    ? [...CORE_STATUS_EMAILS, ...VERBOSE_STATUS_EMAILS]
    : CORE_STATUS_EMAILS;
}

/** Where admin-facing alerts go. Falls back to the reply-to inbox. */
function adminRecipient() {
  return process.env.ORDER_NOTIFICATION_EMAIL || process.env.EMAIL_REPLY_TO || null;
}

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
};

/** Format the stored address snapshot into a readable block. */
function formatAddress(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return [
    snapshot.fullName,
    snapshot.line1,
    snapshot.line2,
    [snapshot.city, snapshot.state].filter(Boolean).join(", "),
    [snapshot.postalCode, snapshot.country].filter(Boolean).join(" "),
    snapshot.phone,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------------------------------------------------------------------------
// Order placed
// ---------------------------------------------------------------------------

/**
 * Confirms a newly placed Cash-on-Delivery order to the customer.
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

  const bodyHtml = [
    heading(`Hi ${firstName(order.user.name)},`),
    paragraphs(
      `Thank you for your order. We've received it and will start preparing it shortly.`,
      `This is a Cash on Delivery order — please keep ${formatMoney(order.total)} ready for the courier when your parcel arrives.`
    ),
    renderInfoRows([
      ["Order number", order.orderNumber],
      ["Order date", new Date(order.createdAt).toDateString()],
      ["Payment", "Cash on Delivery"],
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

Thank you for your order. We've received it and will start preparing it shortly.

Order number: ${order.orderNumber}
Payment: Cash on Delivery

${itemsToText(order.items)}

Total: ${formatMoney(order.total)}

Please keep ${formatMoney(order.total)} ready for the courier.

View your order: ${siteUrl}/dashboard/orders`;

  await sendEmail({
    to: order.user.email,
    template: "order_placed",
    orderId: order.id,
    subject: `Order confirmed — ${order.orderNumber}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text,
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
      ["Payment", "Cash on Delivery"],
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
// Order status changes
// ---------------------------------------------------------------------------

const STATUS_COPY = {
  CONFIRMED: {
    subject: (n) => `Order ${n} confirmed`,
    lead: "Good news — we've confirmed your order and it's being prepared.",
  },
  PROCESSING: {
    subject: (n) => `Order ${n} is being packed`,
    lead: "Your order is being packed and will be handed to the courier soon.",
  },
  SHIPPED: {
    subject: (n) => `Order ${n} has shipped`,
    lead: "Your order is on its way. The courier will contact you on the number you provided.",
  },
  OUT_FOR_DELIVERY: {
    subject: (n) => `Order ${n} is arriving today`,
    lead: "Your order is out for delivery and should reach you today. Please keep your phone nearby — the courier will call when they arrive.",
  },
  DELIVERED: {
    subject: (n) => `Order ${n} delivered`,
    lead: "Your order has been delivered. We hope you love it.",
  },
};

/**
 * Tells the customer their order moved to a new fulfilment status. Silently
 * does nothing for statuses the store doesn't notify on.
 *
 * @param {string} orderId
 * @param {string} status  the new OrderStatus
 */
export async function sendOrderStatusEmail(orderId, status) {
  if (!notifiableStatuses().includes(status)) return;

  const copy = STATUS_COPY[status];
  if (!copy) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_FOR_EMAIL,
  });
  if (!order?.user?.email) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();

  // Delivery is also the moment the return window opens, so say so here rather
  // than making the customer go hunting for the policy. Out for delivery is the
  // last useful moment to remind an unpaid (Cash on Delivery) customer that the
  // courier will want the money at the door.
  let extra = null;
  if (status === "DELIVERED") {
    extra =
      "Your tax invoice is attached. If anything isn't right, you can request a return from your orders page within 7 days.";
  } else if (status === "OUT_FOR_DELIVERY" && order.paymentStatus === "PENDING") {
    extra = `This is a Cash on Delivery order — please have ${formatMoney(order.total)} ready for the courier.`;
  }

  // The invoice rides along with the delivery email — that's the point at which
  // a Cash-on-Delivery sale is actually complete and the cash has been taken.
  // A PDF failure must not cost the customer the notification itself, so this
  // degrades to an unattached email rather than throwing.
  let attachments;
  if (status === "DELIVERED") {
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
  }

  const tracking =
    ["SHIPPED", "OUT_FOR_DELIVERY"].includes(status) && order.trackingNumber
      ? [
          order.courierName ? ["Courier", order.courierName] : null,
          ["Tracking number", order.trackingNumber],
        ].filter(Boolean)
      : [];

  // The customer sees prose, not the enum: "Out for delivery", not
  // "OUT_FOR_DELIVERY".
  const statusText = status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");

  const bodyHtml = [
    heading(`Hi ${firstName(order.user.name)},`),
    paragraphs(copy.lead, extra),
    renderInfoRows([
      ["Order number", order.orderNumber],
      ["Status", statusText],
      ...tracking,
      ["Order total", formatMoney(order.total)],
    ]),
    renderItemsTable(order.items),
    renderButton(`${siteUrl}/dashboard/orders`, "Track your order"),
  ].join("\n");

  const trackingText = tracking.map(([label, value]) => `${label}: ${value}`).join("\n");

  await sendEmail({
    to: order.user.email,
    subject: copy.subject(order.orderNumber),
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `Hi ${firstName(order.user.name)},\n\n${copy.lead}${extra ? `\n\n${extra}` : ""}\n\nOrder: ${order.orderNumber}\nStatus: ${statusText}${trackingText ? `\n${trackingText}` : ""}\n\n${siteUrl}/dashboard/orders`,
    attachments,
    template: `order_${status.toLowerCase()}`,
    orderId: order.id,
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
        ["Cancelled on", new Date(order.cancelledAt ?? Date.now()).toDateString()],
        order.cancelReason ? ["Reason", order.cancelReason] : null,
        refunded > 0 ? ["Refunded", formatMoney(refunded)] : null,
      ].filter(Boolean)
    ),
    renderItemsTable(order.items),
    renderButton(`${siteUrl}/products`, "Continue shopping"),
  ].join("\n");

  await sendEmail({
    to: order.user.email,
    template: "order_cancelled",
    orderId: order.id,
    subject: `Order ${order.orderNumber} cancelled`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `Hi ${firstName(order.user.name)},\n\n${lead}\n\n${money}\n\nOrder: ${order.orderNumber}${order.cancelReason ? `\nReason: ${order.cancelReason}` : ""}`,
  });
}

// ---------------------------------------------------------------------------
// Returns
// ---------------------------------------------------------------------------

const RETURN_FOR_EMAIL = {
  items: { include: { orderItem: true } },
  order: { select: { orderNumber: true } },
  user: { select: { name: true, email: true } },
};

/** Return lines rendered through the shared items table. */
function returnLines(request) {
  return (request.items ?? []).map((line) => ({
    productName: line.orderItem?.productName ?? "Item",
    quantity: line.quantity,
    total: line.amount,
  }));
}

/**
 * Acknowledges a newly opened return/replacement request.
 * @param {string} returnId
 */
export async function sendReturnRequestedEmail(returnId) {
  const request = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    include: RETURN_FOR_EMAIL,
  });
  if (!request?.user?.email) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const isRefund = request.resolution === "REFUND";

  const lead = isRefund
    ? `We've received your return request. Once we get the item back, we'll refund ${formatMoney(request.refundAmount)}.`
    : "We've received your replacement request. Once we get the item back, we'll ship a fresh unit.";

  const bodyHtml = [
    heading(`Hi ${firstName(request.user.name)},`),
    paragraphs(lead, "Please keep the item in its original packaging until it's collected."),
    renderInfoRows(
      [
        ["Return number", request.returnNumber],
        ["Order number", request.order?.orderNumber ?? "—"],
        ["Reason", returnReasonLabel(request.reason)],
        ["You asked for", isRefund ? "Refund" : "Replacement"],
        isRefund ? ["Refund amount", formatMoney(request.refundAmount)] : null,
      ].filter(Boolean)
    ),
    renderItemsTable(returnLines(request)),
    renderButton(`${siteUrl}/dashboard/orders`, "Track your return"),
  ].join("\n");

  await sendEmail({
    to: request.user.email,
    template: "return_requested",
    returnId: request.id,
    subject: `Return requested — ${request.returnNumber}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `Hi ${firstName(request.user.name)},\n\n${lead}\n\nReturn: ${request.returnNumber}\nOrder: ${request.order?.orderNumber}\nReason: ${returnReasonLabel(request.reason)}\n\n${siteUrl}/dashboard/orders`,
  });
}

/**
 * Alerts the store that a return needs reviewing.
 * @param {string} returnId
 */
export async function sendNewReturnAdminEmail(returnId) {
  const to = adminRecipient();
  if (!to) return;

  const request = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    include: RETURN_FOR_EMAIL,
  });
  if (!request) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();

  const bodyHtml = [
    heading(`Return request: ${request.returnNumber}`),
    renderInfoRows(
      [
        ["Order", request.order?.orderNumber ?? "—"],
        ["Customer", request.user?.name || "—"],
        ["Email", request.user?.email || "—"],
        ["Reason", returnReasonLabel(request.reason)],
        ["Wants", request.resolution === "REFUND" ? "Refund" : "Replacement"],
        ["Amount", formatMoney(request.refundAmount)],
      ].filter(Boolean)
    ),
    request.comment
      ? paragraphs(`Customer note: ${request.comment}`)
      : "",
    renderItemsTable(returnLines(request)),
    renderButton(`${siteUrl}/admin/returns`, "Review in admin"),
  ].join("\n");

  await sendEmail({
    to,
    template: "admin_new_return",
    returnId: request.id,
    subject: `Return ${request.returnNumber} needs review`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `Return ${request.returnNumber} on order ${request.order?.orderNumber}\nCustomer: ${request.user?.name} (${request.user?.email})\nReason: ${returnReasonLabel(request.reason)}\nAmount: ${formatMoney(request.refundAmount)}`,
  });
}

/** Per-status lead copy for return lifecycle emails. */
const RETURN_STATUS_LEAD = {
  APPROVED: () => "Your return has been approved. Keep the item packed — a pickup will be scheduled.",
  PICKED_UP: () => "The courier has collected your item. We'll let you know once it reaches us.",
  RECEIVED: () => "We've received your item and are processing your request now.",
  REFUNDED: (r) =>
    `Your refund of ${formatMoney(r.refundAmount)} has been issued. Depending on your bank it may take 3-5 business days to appear.`,
  REPLACED: () => "A replacement unit has been dispatched and is on its way to you.",
  REJECTED: () => "After reviewing your request, we're unable to approve this return.",
  CANCELLED: () => "Your return request has been withdrawn, as requested.",
};

/**
 * Tells the customer their return moved to a new status.
 *
 * @param {string} returnId
 * @param {string} status  the new ReturnStatus
 */
export async function sendReturnStatusEmail(returnId, status) {
  const buildLead = RETURN_STATUS_LEAD[status];
  if (!buildLead) return;

  const request = await prisma.returnRequest.findUnique({
    where: { id: returnId },
    include: RETURN_FOR_EMAIL,
  });
  if (!request?.user?.email) return;

  const { brand, supportEmail, siteUrl } = await getBrandContext();
  const label = RETURN_STATUS_COPY[status]?.label ?? status;
  const lead = buildLead(request);

  const bodyHtml = [
    heading(`Hi ${firstName(request.user.name)},`),
    paragraphs(
      lead,
      // A rejection without a reason is the fastest way to a support ticket.
      status === "REJECTED" && request.adminNote ? `Reason: ${request.adminNote}` : null
    ),
    renderInfoRows(
      [
        ["Return number", request.returnNumber],
        ["Order number", request.order?.orderNumber ?? "—"],
        ["Status", label],
        status === "REFUNDED" ? ["Refunded", formatMoney(request.refundAmount)] : null,
        status === "REFUNDED" && request.refundReference
          ? ["Reference", request.refundReference]
          : null,
      ].filter(Boolean)
    ),
    renderItemsTable(returnLines(request)),
    renderButton(`${siteUrl}/dashboard/orders`, "View your return"),
  ].join("\n");

  await sendEmail({
    to: request.user.email,
    template: `return_${status.toLowerCase()}`,
    returnId: request.id,
    subject: `${label} — ${request.returnNumber}`,
    html: renderEmailLayout({ brand, supportEmail, bodyHtml }),
    text: `Hi ${firstName(request.user.name)},\n\n${lead}\n\nReturn: ${request.returnNumber}\nStatus: ${label}\n\n${siteUrl}/dashboard/orders`,
  });
}
