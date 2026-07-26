/** @type {import('next').NextConfig} */

// Image optimization is what keeps media data transfer survivable.
//
// Without this block, every product still was served straight from the bucket at
// full size (376 KB – 1.1 MB JPEGs) to every visitor, on every view. With it,
// Next resizes/re-encodes once, caches the result on the CDN, and storage is only
// touched on a cache miss — the same "one master, many cached derivatives" trick
// Amazon does with its `._AC_SL1500_.jpg` URL directives.

// The R2 bucket's public host, taken from the same env var the storage driver
// uses so there is exactly one place to change when the bucket moves from the
// rate-limited *.r2.dev development URL to a custom domain. Deliberately NOT
// wildcarded to `**.r2.dev`: remotePatterns is what stops the optimizer being
// used as an open image proxy, and every R2 bucket on earth shares that suffix.
const r2Host = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL).hostname;
  } catch {
    // Unset or malformed — fine when STORAGE_DRIVER=local.
    return null;
  }
})();

const nextConfig = {
  reactCompiler: true,

  images: {
    // Only hosts listed here may be optimized; anything else returns 400. Admins
    // can paste arbitrary URLs into the media fields, so `isOptimizableSrc()` in
    // `src/lib/media.js` mirrors this list and falls back to `unoptimized` for
    // unknown hosts rather than letting the image break. Keep the two in sync.
    remotePatterns: [
      // Cloudflare R2 — where uploads go now.
      ...(r2Host ? [{ protocol: "https", hostname: r2Host, pathname: "/**" }] : []),
      // Vercel Blob. Kept so product rows written before the R2 migration keep
      // rendering; nothing new is ever written here. Wildcarded on the store
      // subdomain so rotating the store does not blank every legacy image.
      {
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
        pathname: "/**",
      },
      // Stock fallback used by ProductCard's FALLBACK_IMG.
      {
        protocol: "https",
        hostname: "images.pexels.com",
        pathname: "/**",
      },
    ],

    // Required from Next 16: an explicit allowlist of `quality` values. 75 is the
    // component default; 50 is used for small thumbnails where nobody can tell.
    qualities: [50, 75],

    // WebP is ~30% smaller than JPEG at equal quality and is universally
    // supported. (AVIF would save more but is much slower to encode and bills as
    // a separate transformation per variant.)
    formats: ["image/webp"],

    // `buildKey()` in src/lib/storage/ gives every upload a random segment, so a
    // URL's bytes never change — the asset ID is effectively immutable, exactly
    // like Amazon's. That makes a long TTL safe: re-editing a product yields a
    // NEW url, so there is nothing to invalidate. Fewer expirations means fewer
    // re-fetches from the bucket.
    minimumCacheTTL: 2678400, // 31 days

    // Trimmed from the default list, which tops out at 3840px. Nothing on this
    // site renders a product wider than ~1200px, and every extra entry is another
    // billable transformation plus another large variant Blob has to serve once.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
};

export default nextConfig;
