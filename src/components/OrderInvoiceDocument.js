import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";
import { TAX_INCLUSIVE_LABEL } from "@/lib/pricing";

// ─────────────────────────────────────────────────────────────────────────────
// Commercial invoice for a single order. Rendered on the server (see lib/invoice.js)
// and both attached to the delivery email and served from the customer's
// orders page.
//
// Every amount is passed in already computed — this component does no pricing
// arithmetic of its own, so an invoice can never disagree with the order it
// describes. Prices are tax-inclusive and final (see lib/pricing.js), so there
// is no tax line to break out: the totals block runs goods → delivery → total.
// ─────────────────────────────────────────────────────────────────────────────

const EMERALD = "#047857";
const INK = "#0f1111";
const BODY = "#3f4545";
const MUTED = "#565959";
const LINE = "#e2e8f0";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 56, paddingHorizontal: 40, fontSize: 9.5, color: BODY, fontFamily: "Helvetica" },

  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 12, marginBottom: 18 },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: EMERALD, letterSpacing: 1 },
  brandMeta: { fontSize: 8, color: MUTED, marginTop: 3 },
  docTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", color: INK, textAlign: "right" },
  docMeta: { fontSize: 8.5, color: MUTED, textAlign: "right", marginTop: 3 },

  cols: { flexDirection: "row", gap: 24, marginBottom: 20 },
  col: { flex: 1 },
  colTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: EMERALD, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 5 },
  colLine: { fontSize: 9.5, color: INK, lineHeight: 1.5 },

  tHead: { flexDirection: "row", backgroundColor: "#f8fafc", borderTopWidth: 1, borderBottomWidth: 1, borderColor: LINE, paddingVertical: 6 },
  tHeadCell: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.4 },
  tRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 7 },
  cItem: { width: "59%", paddingRight: 6 },
  cQty: { width: "10%", textAlign: "center" },
  cRate: { width: "15%", textAlign: "right" },
  cTotal: { width: "16%", textAlign: "right" },
  itemName: { fontSize: 9.5, color: INK },
  cell: { fontSize: 9.5, color: BODY },

  totalsWrap: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  totals: { width: "52%" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3 },
  totalLabel: { fontSize: 9.5, color: MUTED },
  totalValue: { fontSize: 9.5, color: INK },
  grandRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: LINE, marginTop: 6, paddingTop: 7 },
  grandLabel: { fontSize: 12, fontFamily: "Helvetica-Bold", color: INK },
  grandValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: EMERALD },
  refundRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 5 },
  refundLabel: { fontSize: 9.5, color: "#b91c1c" },
  refundValue: { fontSize: 9.5, color: "#b91c1c" },

  note: { marginTop: 22, padding: 10, backgroundColor: "#f8fafc", borderRadius: 4, borderLeftWidth: 3, borderLeftColor: EMERALD },
  noteText: { fontSize: 8.5, color: MUTED, lineHeight: 1.5 },

  footer: { position: "absolute", bottom: 28, left: 40, right: 40, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8, flexDirection: "row", justifyContent: "space-between" },
  footText: { fontSize: 7.5, color: MUTED },
});

/** One address block, rendered from the order's stored snapshot. */
function AddressBlock({ title, lines }) {
  return (
    <View style={s.col}>
      <Text style={s.colTitle}>{title}</Text>
      {lines.filter(Boolean).map((line, i) => (
        <Text key={i} style={s.colLine}>{line}</Text>
      ))}
    </View>
  );
}

/**
 * @param {object} props
 * @param {object} props.invoice  fully computed invoice data from lib/invoice.js
 */
export function OrderInvoiceDocument({ invoice }) {
  const {
    brand,
    supportEmail,
    companyAddress,
    invoiceNumber,
    orderNumber,
    orderDate,
    paymentMethod,
    paymentStatus,
    shipTo,
    items,
    subtotal,
    shipping,
    total,
    refunded,
    money,
  } = invoice;

  return (
    <Document
      title={`Invoice ${invoiceNumber}`}
      author={brand}
      subject={`Invoice for order ${orderNumber}`}
    >
      <Page size="A4" style={s.page}>
        <View style={s.brandRow}>
          <View>
            <Text style={s.brand}>{brand}</Text>
            {companyAddress ? <Text style={s.brandMeta}>{companyAddress}</Text> : null}
            <Text style={s.brandMeta}>{supportEmail}</Text>
          </View>
          <View>
            <Text style={s.docTitle}>INVOICE</Text>
            <Text style={s.docMeta}>Invoice no. {invoiceNumber}</Text>
            <Text style={s.docMeta}>Order no. {orderNumber}</Text>
            <Text style={s.docMeta}>Date: {orderDate}</Text>
          </View>
        </View>

        <View style={s.cols}>
          <AddressBlock title="Billed / Shipped to" lines={shipTo} />
          <AddressBlock
            title="Payment"
            lines={[paymentMethod, `Status: ${paymentStatus}`]}
          />
        </View>

        <View style={s.tHead}>
          <Text style={[s.tHeadCell, s.cItem]}>Item</Text>
          <Text style={[s.tHeadCell, s.cQty]}>Qty</Text>
          <Text style={[s.tHeadCell, s.cRate]}>Unit price</Text>
          <Text style={[s.tHeadCell, s.cTotal]}>Amount</Text>
        </View>

        {items.map((item, i) => (
          <View key={i} style={s.tRow} wrap={false}>
            <View style={s.cItem}>
              <Text style={s.itemName}>{item.name}</Text>
            </View>
            <Text style={[s.cell, s.cQty]}>{item.quantity}</Text>
            <Text style={[s.cell, s.cRate]}>{money(item.price)}</Text>
            <Text style={[s.cell, s.cTotal]}>{money(item.total)}</Text>
          </View>
        ))}

        <View style={s.totalsWrap}>
          <View style={s.totals}>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Subtotal</Text>
              <Text style={s.totalValue}>{money(subtotal)}</Text>
            </View>
            <View style={s.totalRow}>
              <Text style={s.totalLabel}>Delivery</Text>
              <Text style={s.totalValue}>{shipping > 0 ? money(shipping) : "Free"}</Text>
            </View>
            <View style={s.grandRow}>
              <Text style={s.grandLabel}>Total</Text>
              <Text style={s.grandValue}>{money(total)}</Text>
            </View>
            {refunded > 0 ? (
              <View style={s.refundRow}>
                <Text style={s.refundLabel}>Refunded</Text>
                <Text style={s.refundValue}>- {money(refunded)}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Says in words what the totals block already does in numbers: the
            amounts above are final, with no tax to be added on top. */}
        <View style={s.note}>
          <Text style={s.noteText}>
            {TAX_INCLUSIVE_LABEL}. All amounts are in AED and final — no tax is
            added on top of the prices shown.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text style={s.footText}>{brand} — {supportEmail}</Text>
          <Text
            style={s.footText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}
