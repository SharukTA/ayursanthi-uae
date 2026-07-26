import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Local-filesystem storage driver — files land in public/uploads/ and Next
// serves them statically from this origin.
//
// This is the development / self-hosted driver. It cannot work on Vercel, whose
// filesystem is read-only at runtime and whose instances do not share a disk;
// use STORAGE_DRIVER=r2 there. Uploads still go through the same two-step
// handshake as R2 (ask for a target, then PUT to it) so the browser code is
// identical for both drivers — the only difference is that the target URL points
// back at our own route instead of at a bucket.
// ─────────────────────────────────────────────────────────────────────────────

const UPLOADS_ROOT = path.join(process.cwd(), "public", "uploads");
const URL_PREFIX = "/uploads/";

export function publicUrl(key) {
  return URL_PREFIX + key.split("/").map(encodeURIComponent).join("/");
}

export function keyFromUrl(url) {
  if (typeof url !== "string" || !url.startsWith(URL_PREFIX)) return null;

  try {
    return decodeURIComponent(url.slice(URL_PREFIX.length));
  } catch {
    return null;
  }
}

// Resolves a key to an absolute path, refusing anything that escapes the
// uploads root. The key travels through the browser on the PUT leg, so it is
// caller-controlled input: "../../.env" would otherwise be an arbitrary file
// write. Comparing resolved paths catches traversal in every encoding, which a
// string blocklist on ".." does not.
export function resolveKey(key) {
  const resolved = path.resolve(UPLOADS_ROOT, key);
  const root = UPLOADS_ROOT + path.sep;

  if (!resolved.startsWith(root)) {
    throw new Error("Invalid upload path.");
  }
  return resolved;
}

export async function createUploadTarget(key, contentType) {
  return {
    method: "PUT",
    url: `/api/admin/upload?key=${encodeURIComponent(key)}`,
    headers: { "content-type": contentType },
  };
}

export async function write(key, body) {
  const target = resolveKey(key);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
}

export async function remove(key) {
  try {
    await unlink(resolveKey(key));
  } catch (error) {
    // Already gone is success — the goal is "no orphan file", not "we deleted".
    if (error.code !== "ENOENT") throw error;
  }
}
