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

// Content-Security-Policy, assembled here so the R2 host is filled in from the
// same env var everything else uses.
//
// Two directives carry most of the weight. `frame-ancestors 'none'` stops the
// site being framed, which is what makes a clickjacked "Place order" or "Cancel
// order" click impossible. `default-src 'self'` means an injected tag pointing
// at an attacker's host fetches nothing.
//
// 'unsafe-inline' is present for scripts and styles because Next.js inlines both
// the hydration bootstrap and the RSC flight payload into the HTML, and there is
// no nonce plumbed through this app. It weakens the XSS half of the policy — but
// the app has no dangerouslySetInnerHTML and no eval anywhere, so the realistic
// injection routes are closed at the source, and the host allowlist still blocks
// exfiltration to a third party. Adding a nonce via proxy.js is the upgrade path.
function contentSecurityPolicy() {
  const media = ["'self'", "data:", "blob:", r2Host && `https://${r2Host}`, "https://images.pexels.com"]
    .filter(Boolean)
    .join(" ");

  return [
    "default-src 'self'",
    // 'unsafe-eval' is dev-only: the React refresh runtime needs it, production
    // builds do not.
    `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src ${media}`,
    `media-src ${media}`,
    "font-src 'self' data:",
    // The admin media uploader PUTs bytes straight from the browser to the
    // bucket using a presigned URL (src/lib/storage/client.js), so the R2 origin
    // has to be reachable by fetch — without it every upload fails as a CSP
    // violation rather than as an HTTP error.
    `connect-src 'self'${r2Host ? ` https://${r2Host}` : ""}`,
    // Nothing on the site embeds a frame, and nothing may embed the site.
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    // Confines <base> and form posts, so an injected tag cannot re-point
    // relative URLs or aim a form at somebody else's server.
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

const nextConfig = {
  reactCompiler: true,

  // "X-Powered-By: Next.js" only ever tells an attacker what to target.
  poweredByHeader: false,

  // Response headers for every route. These are the browser-enforced half of the
  // site's security posture — the server-side half lives in requireAdmin() and
  // getSession(). Applied to "/:path*" so API responses carry them too.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          // Two years, subdomains included, and preload-eligible. Vercel already
          // redirects http→https; this is what stops the very first request of a
          // session going out in plaintext to be intercepted.
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // Stops the browser second-guessing a Content-Type — the mechanism
          // that turns an innocently-typed upload into an executable script.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Belt and braces with frame-ancestors above, for anything that still
          // only understands the older header.
          { key: "X-Frame-Options", value: "DENY" },
          // Send the full URL only to ourselves. Order pages carry ids and
          // Stripe session ids in the query string, and those must not travel to
          // a third party in a Referer header.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // The site asks for none of these, so nothing embedded in it may ask
          // either.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
          },
        ],
      },
    ];
  },

  images: {
    // Only hosts listed here may be optimized; anything else returns 400. Admins
    // can paste arbitrary URLs into the media fields, so `isOptimizableSrc()` in
    // `src/lib/media.js` mirrors this list and falls back to `unoptimized` for
    // unknown hosts rather than letting the image break. Keep the two in sync.
    remotePatterns: [
      // Cloudflare R2 — where every upload lives.
      ...(r2Host ? [{ protocol: "https", hostname: r2Host, pathname: "/**" }] : []),
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
    // billable transformation plus another large variant R2 has to serve once.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
  },
};

export default nextConfig;
