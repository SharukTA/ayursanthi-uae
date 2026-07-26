import sharp from "sharp";

// Media served straight out of `public/` is stored as a root-relative path
// ("/products/foo.jpg"). Node's fetch only accepts absolute URLs, so such a path
// would throw, get swallowed by the catch below, and the PDF would quietly render
// with no images at all. Resolving against the site origin keeps local media
// working exactly like remote (Blob/R2) URLs.
const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

function toAbsolute(url) {
  return url.startsWith("/") ? `${SITE_ORIGIN}${url}` : url;
}

// Fetches a list of image URLs and converts each to a PNG buffer that react-pdf
// can embed (it only understands JPEG/PNG, so we normalise everything — webp,
// avif, gif frame 1, etc. — through sharp). Images are downscaled to keep the
// PDF small. Returns a Map<url, { data: Buffer, format: "png" }>; any URL that
// fails to fetch or decode is simply left out, so the document skips it.
export async function fetchPdfImages(urls, { maxWidth = 600 } = {}) {
  const unique = [...new Set(urls.filter(Boolean))];
  const map = new Map();

  await Promise.all(
    unique.map(async (url) => {
      try {
        const res = await fetch(toAbsolute(url));
        if (!res.ok) return;
        // Keyed by the ORIGINAL url, since that's what the document looks up.
        const input = Buffer.from(await res.arrayBuffer());
        const data = await sharp(input)
          .rotate() // respect EXIF orientation
          .resize({ width: maxWidth, withoutEnlargement: true })
          .png()
          .toBuffer();
        map.set(url, { data, format: "png" });
      } catch {
        // Unreachable/undecodable image — skip it rather than failing the PDF.
      }
    })
  );

  return map;
}
