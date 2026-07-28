import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { formatMoney, getBrandContext } from "@/lib/email";
import { getSiteSettings } from "@/lib/settings";
import { OrderInvoiceDocument } from "@/components/OrderInvoiceDocument";

/**
 * Builds the commercial invoice for an order.
 *
 * Amounts are read straight off the stored order — never recomputed — so the
 * invoice always matches what the customer was actually charged, even if a
 * product’s price has changed since. No tax is shown: the store is not
 * VAT-registered, so it may not issue a tax invoice (see lib/pricing.js).
 */

/** Invoice numbers are derived from the order, so they're stable across renders. */
function invoiceNumberFor(order) {
  return `INV-${order.orderNumber.replace(/^ORD-/, "")}`;
}

const PAYMENT_STATUS_COPY = {
  PENDING: "Pending — payable on delivery",
  PAID: "Paid",
  FAILED: "Not collected",
  REFUNDED: "Refunded",
};

/** Flatten the stored address snapshot into printable lines. */
function addressLines(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return ["—"];
  return [
    snapshot.fullName,
    snapshot.line1,
    snapshot.line2,
    [snapshot.city, snapshot.state].filter(Boolean).join(", "),
    [snapshot.postalCode, snapshot.country].filter(Boolean).join(" "),
    snapshot.phone ? `Phone: ${snapshot.phone}` : null,
  ].filter(Boolean);
}

/**
 * Assemble everything the invoice document needs.
 * @param {object} order  an Order including `items`
 */
async function buildInvoiceData(order) {
  const { brand, supportEmail } = await getBrandContext();

  let companyAddress = "";
  try {
    const settings = await getSiteSettings();
    companyAddress = settings.contact_address?.trim() || "";
  } catch {
    // Settings unavailable — the invoice simply omits the address line.
  }

  return {
    brand,
    supportEmail,
    companyAddress,
    invoiceNumber: invoiceNumberFor(order),
    orderNumber: order.orderNumber,
    orderDate: new Date(order.createdAt).toDateString(),
    paymentMethod: "Cash on Delivery",
    paymentStatus: PAYMENT_STATUS_COPY[order.paymentStatus] || order.paymentStatus,
    shipTo: addressLines(order.addressSnapshot),
    items: (order.items ?? []).map((item) => ({
      name: item.productName,
      quantity: item.quantity,
      price: Number(item.price),
      total: Number(item.total),
    })),
    subtotal: Number(order.subtotal),
    shipping: Number(order.shipping ?? 0),
    total: Number(order.total),
    refunded: Number(order.refundedTotal ?? 0),
    // Passed in rather than imported by the document so the PDF and the emails
    // can never disagree about currency formatting.
    money: formatMoney,
  };
}

/**
 * Render an order's invoice to a PDF buffer.
 *
 * @param {string} orderId
 * @returns {Promise<{ buffer: Buffer, filename: string, orderNumber: string } | null>}
 *          null when the order doesn't exist.
 */
export async function renderOrderInvoice(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return null;

  const invoice = await buildInvoiceData(order);
  const buffer = await renderToBuffer(<OrderInvoiceDocument invoice={invoice} />);

  return {
    buffer,
    filename: `${invoice.invoiceNumber}.pdf`,
    orderNumber: order.orderNumber,
  };
}
