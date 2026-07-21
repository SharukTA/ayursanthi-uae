import sharp from "sharp";

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
        const res = await fetch(url);
        if (!res.ok) return;
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
