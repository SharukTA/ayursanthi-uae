import { handleUpload } from "@vercel/blob/client";
import { jsonError, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// Media now lives in Vercel Blob storage, not on the local filesystem. The
// browser uploads the file DIRECTLY to Blob (see MediaUrlField/ImageUrlField),
// which bypasses the ~4.5 MB serverless request-body limit and works on Vercel's
// read-only filesystem. This route no longer receives the file itself — it only
// hands the client a short-lived, admin-gated upload token.

// Accepted video container types.
const VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];
// Accepted image types for the imageUrl fields (deals, promo banners, etc.).
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

// POST /api/admin/upload — token endpoint for client-side Blob uploads. The body
// is a small JSON handshake from @vercel/blob/client (not the file), so there's
// no 413. Admin-only: the token is only issued to an authenticated ADMIN.
export async function POST(request) {
  try {
    const body = await request.json();

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        const { error } = await requireAdmin();
        // requireAdmin returns a Response on failure; throwing here makes
        // handleUpload reject the token request (the client surfaces the message).
        if (error) throw new Error("Administrator access required.");

        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_BYTES,
          addRandomSuffix: true, // avoid collisions on same-named files
        };
      },
      // Fired by Blob after a successful upload. The client already receives the
      // final URL directly, so nothing to persist here. (Not called on
      // localhost, since Blob can't reach a local callback URL — that's fine.)
      onUploadCompleted: async () => {},
    });

    return Response.json(jsonResponse);
  } catch (error) {
    console.error("Upload token error:", error);
    return jsonError(error.message || "Unable to upload file.", 400);
  }
}
