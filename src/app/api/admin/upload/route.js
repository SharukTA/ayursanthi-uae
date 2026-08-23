import { createUpload, writeLocalUpload, DRIVER } from "@/lib/storage";
import { jsonError, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// Media lives in object storage (Cloudflare R2), not on the local filesystem.
// The browser uploads the file DIRECTLY to the bucket using a presigned URL this
// route hands out, which bypasses the ~4.5 MB serverless request-body limit and
// works on Vercel's read-only filesystem. POST issues the target; the bytes only
// come back through PUT when STORAGE_DRIVER=local (dev). See src/lib/storage/.

// Accepted video container types.
//
// `video/quicktime` (.mov) is deliberately NOT here. iPhones record .mov by
// default, so it gets uploaded constantly — but Chrome and Firefox cannot play
// it, and a browser that can't decode a video renders a silent black box with no
// error. Admins upload it, the preview looks fine in Safari, and every other
// visitor sees nothing. Rejecting it at the door is the only reliable fix;
// `scripts/compress-videos.mjs` already outputs .mp4, so converting is one
// command. MP4 (H.264) plays everywhere.
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg"];
// Accepted image types for the imageUrl fields (deals, promo banners, etc.).
//
// `image/svg+xml` is accepted deliberately — admins do upload vector artwork
// (logos, payment marks) and rasterising it would lose the point of having it.
//
// It carries a caveat worth knowing, because an SVG is a document rather than a
// picture: it can contain <script> and event handlers, and those RUN if the file
// is navigated to directly. Through an <img> tag — which is how every one of
// these is rendered — nothing executes.
//
// Two things keep that harmless today, and both are load-bearing:
//
//   1. Uploads are admin-only (requireAdmin above), so posting one already
//      requires an admin account.
//   2. R2 serves them from its own origin (pub-….r2.dev), NOT from
//      ayurshoppee.ae. Script in an SVG therefore runs somewhere with no access
//      to this site's cookies — and the session cookie is host-only, so it is
//      never sent to another host anyway.
//
// Point 2 is the fragile one. Moving the bucket onto a subdomain of the site
// (media.ayurshoppee.ae) would break it: a page there can set a cookie scoped to
// the parent domain, which is a session-fixation route, and it can phish under
// the real brand name. If the bucket ever moves to a custom domain, keep it on a
// separate registrable domain, or serve uploads with
// `Content-Disposition: attachment` so an SVG downloads instead of rendering.
//
// Note the CSP in next.config.mjs does NOT cover this: R2 serves its own
// responses with its own headers and never sees that policy.
const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "image/svg+xml",
];
const ALLOWED_CONTENT_TYPES = [...VIDEO_TYPES, ...IMAGE_TYPES];

const MAX_BYTES = 500 * 1024 * 1024; // 500 MB — generous headroom for videos.

// POST /api/admin/upload — hands the browser a one-shot upload target.
//
// The body is a small JSON handshake (not the file), so there's no 413. The
// content type is validated here AND baked into the presigned URL's signature,
// so a client cannot upload a .exe by lying after the fact. The declared size is
// advisory — a presigned PUT can't enforce a length — but this endpoint is
// admin-only, so the check is a guard against mistakes, not against attackers.
export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { filename, contentType, size } = await request.json();

    if (!ALLOWED_CONTENT_TYPES.includes(contentType)) {
      return jsonError(
        "Unsupported file type. Use JPEG, PNG, WebP, GIF, AVIF or SVG for images, MP4, WebM or Ogg for video.",
        415
      );
    }

    if (typeof size === "number" && size > MAX_BYTES) {
      return jsonError("File is too large. The limit is 500 MB.", 413);
    }

    const plan = await createUpload({ filename, contentType });

    return Response.json({ publicUrl: plan.publicUrl, upload: plan.upload });
  } catch (error) {
    console.error("Upload target error:", error);
    return jsonError(error.message || "Unable to start upload.", 400);
  }
}

// PUT /api/admin/upload?key=... — receiving end of the LOCAL driver's upload.
//
// Only reachable when STORAGE_DRIVER=local; with R2 the browser PUTs straight to
// the bucket and never touches this. `key` is caller-controlled, so
// storage/local.js refuses any key that resolves outside public/uploads/.
export async function PUT(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  if (DRIVER !== "local") {
    return jsonError("Direct uploads are not accepted by this storage driver.", 405);
  }

  try {
    const key = request.nextUrl.searchParams.get("key");
    if (!key) return jsonError("Missing upload key.", 400);

    const body = Buffer.from(await request.arrayBuffer());
    if (body.byteLength > MAX_BYTES) {
      return jsonError("File is too large. The limit is 500 MB.", 413);
    }

    await writeLocalUpload(key, body);

    return Response.json({ message: "Uploaded." });
  } catch (error) {
    console.error("Upload write error:", error);
    return jsonError(error.message || "Unable to upload file.", 400);
  }
}
