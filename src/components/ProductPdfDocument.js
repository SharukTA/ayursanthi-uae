import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  Polygon,
  StyleSheet,
} from "@react-pdf/renderer";
import { parseRichText } from "@/components/RichText";

// ─────────────────────────────────────────────────────────────────────────────
// Printable product sheet. Rendered on the server (see the /pdf route) into a
// real PDF: wordmark header, product name + category, star rating, price block,
// a gallery of the product images, the specifications table and the full
// description (headings, bullets, paragraphs and any inline images).
//
// Images are passed in already fetched and converted to PNG (react-pdf only
// embeds JPEG/PNG), keyed by their original URL, so this component just looks
// them up — a missing/failed image is simply skipped.
// ─────────────────────────────────────────────────────────────────────────────

const EMERALD = "#047857";
const INK = "#0f1111";
const BODY = "#3f4545";
const MUTED = "#565959";
const LINE = "#e2e8f0";
const GOLD = "#f59e0b";

const s = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 48, paddingHorizontal: 40, fontSize: 10, color: BODY, fontFamily: "Helvetica" },
  brandRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: LINE, paddingBottom: 10, marginBottom: 16 },
  brand: { fontSize: 15, fontFamily: "Helvetica-Bold", color: EMERALD, letterSpacing: 1 },
  brandMeta: { fontSize: 8, color: MUTED },
  category: { fontSize: 8, fontFamily: "Helvetica-Bold", color: EMERALD, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  name: { fontSize: 20, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 6 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  ratingText: { fontSize: 9, color: MUTED },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 14 },
  price: { fontSize: 18, fontFamily: "Helvetica-Bold", color: EMERALD },
  mrp: { fontSize: 10, color: MUTED, textDecoration: "line-through" },
  offer: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#92400e", backgroundColor: "#fef3c7", paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3 },
  short: { fontSize: 10, color: BODY, lineHeight: 1.5, marginBottom: 14 },
  gallery: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  galleryImg: { width: 150, height: 150, objectFit: "cover", borderRadius: 4, border: `1 solid ${LINE}` },
  sectionTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: INK, marginBottom: 8, marginTop: 8 },
  sectionRule: { width: 34, height: 2, backgroundColor: EMERALD, borderRadius: 2, marginBottom: 10 },
  specRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: LINE },
  specLabelCell: { width: "35%", backgroundColor: "#f8fafc", padding: 6, fontFamily: "Helvetica-Bold", color: MUTED },
  specValueCell: { width: "65%", padding: 6, color: INK },
  descHeading: { fontSize: 12, fontFamily: "Helvetica-Bold", color: INK, marginTop: 12, marginBottom: 4 },
  descSubheading: { fontSize: 10, fontFamily: "Helvetica-Bold", color: INK, marginTop: 8, marginBottom: 2 },
  descPara: { fontSize: 10, color: BODY, lineHeight: 1.5, marginBottom: 4 },
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 10, fontSize: 10, color: EMERALD },
  bulletText: { flex: 1, fontSize: 10, color: BODY, lineHeight: 1.5 },
  descImgRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 6 },
  descImg: { width: 130, height: 130, objectFit: "cover", borderRadius: 4, border: `1 solid ${LINE}` },
  descCaption: { fontSize: 8, color: MUTED, width: 130, marginTop: 2 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, textAlign: "center", fontSize: 8, color: MUTED, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
});

// A single 5-point star, filled or empty, drawn as an SVG polygon so it doesn't
// depend on the font having a star glyph.
function Star({ filled }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 51 48">
      <Polygon
        points="25,1 32,17 49,18 36,29 40,46 25,37 10,46 14,29 1,18 18,17"
        fill={filled ? GOLD : "#e5e7eb"}
      />
    </Svg>
  );
}

function Stars({ rating }) {
  const rounded = Math.round(rating);
  return (
    <View style={{ flexDirection: "row", gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} filled={n <= rounded} />
      ))}
    </View>
  );
}

// Renders one image lookup (by URL) as a react-pdf <Image>, or nothing if we
// couldn't fetch/convert it.
function PdfImage({ url, images, style }) {
  const img = images.get(url);
  if (!img) return null;
  // react-pdf's <Image> is a PDF primitive, not an HTML <img> — no alt prop.
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image src={img} style={style} />;
}

function Description({ body, images }) {
  const blocks = parseRichText(body || "");
  if (blocks.length === 0) {
    return <Text style={s.descPara}>No full description available.</Text>;
  }

  return (
    <View>
      {blocks.map((block, idx) => {
        if (block.type === "h3") {
          return <Text key={idx} style={s.descHeading}>{block.text}</Text>;
        }
        if (block.type === "h4") {
          return <Text key={idx} style={s.descSubheading}>{block.text}</Text>;
        }
        if (block.type === "ul") {
          return (
            <View key={idx} style={{ marginVertical: 3 }}>
              {block.items.map((item, i) => (
                <View key={i} style={s.bulletRow}>
                  <Text style={s.bulletDot}>•</Text>
                  <Text style={s.bulletText}>{item}</Text>
                </View>
              ))}
            </View>
          );
        }
        if (block.type === "images") {
          return (
            <View key={idx} style={s.descImgRow}>
              {block.items.map((im, i) => (
                <View key={i}>
                  <PdfImage url={im.url} images={images} style={s.descImg} />
                  {im.alt ? <Text style={s.descCaption}>{im.alt}</Text> : null}
                </View>
              ))}
            </View>
          );
        }
        // Paragraph — keep the author's line breaks.
        return (
          <Text key={idx} style={s.descPara}>{block.text}</Text>
        );
      })}
    </View>
  );
}

export function ProductPdfDocument({ product, images }) {
  const {
    name,
    category,
    sku,
    price,
    mrp,
    offerLabel,
    shortDescription,
    description,
    attributes = [],
    galleryUrls = [],
    rating = 0,
    reviewCount = 0,
  } = product;

  const discount =
    mrp && Number(mrp) > Number(price)
      ? Math.round(((Number(mrp) - Number(price)) / Number(mrp)) * 100)
      : null;
  const badge = offerLabel?.trim() || (discount ? `${discount}% OFF` : null);
  const printedOn = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

  return (
    <Document title={`${name} — Ayursanthi`} author="Ayursanthi">
      <Page size="A4" style={s.page}>
        <View style={s.brandRow} fixed>
          <Text style={s.brand}>AYURSANTHI</Text>
          <Text style={s.brandMeta}>Product Details</Text>
        </View>

        {category?.name ? <Text style={s.category}>{category.name}</Text> : null}
        <Text style={s.name}>{name}</Text>

        <View style={s.ratingRow}>
          <Stars rating={rating} />
          <Text style={s.ratingText}>
            {reviewCount > 0
              ? `${rating.toFixed(1)} out of 5  (${reviewCount.toLocaleString("en-IN")} rating${reviewCount > 1 ? "s" : ""})`
              : "No ratings yet"}
          </Text>
        </View>

        <View style={s.priceRow}>
          <Text style={s.price}>Rs. {Number(price).toLocaleString("en-IN")}</Text>
          {mrp ? <Text style={s.mrp}>Rs. {Number(mrp).toLocaleString("en-IN")}</Text> : null}
          {badge ? <Text style={s.offer}>{badge}</Text> : null}
        </View>

        {shortDescription ? <Text style={s.short}>{shortDescription}</Text> : null}

        {galleryUrls.length > 0 ? (
          <View style={s.gallery}>
            {galleryUrls.map((url, i) => (
              <PdfImage key={i} url={url} images={images} style={s.galleryImg} />
            ))}
          </View>
        ) : null}

        {attributes.length > 0 ? (
          <View wrap={false}>
            <Text style={s.sectionTitle}>Specifications</Text>
            <View style={s.sectionRule} />
            <View style={{ borderWidth: 1, borderColor: LINE, borderRadius: 4, overflow: "hidden" }}>
              {attributes.map((attr, i) => (
                <View key={i} style={i === attributes.length - 1 ? { ...s.specRow, borderBottomWidth: 0 } : s.specRow}>
                  <Text style={s.specLabelCell}>{attr.label}</Text>
                  <Text style={s.specValueCell}>{attr.value}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View>
          <Text style={s.sectionTitle}>Detailed Description</Text>
          <View style={s.sectionRule} />
          <Description body={description} images={images} />
        </View>

        <Text style={s.footer} fixed>
          {sku ? `SKU ${sku}  ·  ` : ""}Generated on {printedOn}  ·  Ayursanthi
        </Text>
      </Page>
    </Document>
  );
}
