import { randomUUID } from "node:crypto";
import path from "node:path";

import * as local from "./local";
import * as r2 from "./r2";

// ─────────────────────────────────────────────────────────────────────────────
// Media storage — one interface, two backends, chosen by STORAGE_DRIVER.
//
//   "local" (default) → public/uploads/, served from this origin. Dev only.
//   "r2"              → Cloudflare R2, uploaded straight from the browser.
//
// Every upload is a two-step handshake, identical for both drivers:
//
//   1. POST /api/admin/upload  → admin check, then `createUpload()` returns a
//      key, the final public URL, and a one-shot target to send the bytes to.
//   2. PUT <target>            → the browser sends the file itself, either to
//      R2's presigned URL or back to our own route for the local driver.
//
// The file never passes through a route handler on R2, which is what keeps
// large videos clear of the ~4.5 MB serverless body limit.
//
// SERVER ONLY — this module reaches for node:fs and the R2 secret key. Client
// components use `uploadMedia()` from ./client instead.
// ─────────────────────────────────────────────────────────────────────────────

export const DRIVER = process.env.STORAGE_DRIVER === "r2" ? "r2" : "local";

const driver = DRIVER === "r2" ? r2 : local;

// Turns "My Photo (final).JPEG" into "my-photo-final.jpeg". The original name is
// kept in readable form because it is the only clue about an object's contents
// when browsing the bucket, but nothing downstream depends on it — collisions
// are handled by the random prefix, not by the name.
function safeName(filename) {
  const name = String(filename || "file").split(/[\\/]/).pop();
  const ext = path.extname(name).toLowerCase().replace(/[^.a-z0-9]/g, "").slice(0, 10);
  const base = path
    .basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);

  return (base || "file") + ext;
}

// Every upload gets a fresh random segment, so a stored URL's bytes never
// change once written. That immutability is what makes the 31-day
// `minimumCacheTTL` in next.config.mjs safe: re-editing a product produces a NEW
// url, so there is never a stale derivative to invalidate. The date folders are
// purely for human navigation in the R2 dashboard.
export function buildKey(filename) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const random = randomUUID().replace(/-/g, "").slice(0, 12);

  return `media/${year}/${month}/${random}-${safeName(filename)}`;
}

// Returns { key, publicUrl, upload: { method, url, headers } }. `publicUrl` is
// where the file WILL live — it is safe to store only after the PUT succeeds.
export async function createUpload({ filename, contentType }) {
  const key = buildKey(filename);

  return {
    key,
    publicUrl: driver.publicUrl(key),
    upload: await driver.createUploadTarget(key, contentType),
  };
}

// Deletes the backing file for a stored URL, but only when the URL is one this
// driver actually owns. Returns false without touching anything for external
// URLs an admin pasted, and for URLs written by the *other* driver — including
// the Vercel Blob URLs left in the database from before this migration, which
// have to be cleaned up in the Blob dashboard rather than here.
export async function deleteByUrl(url) {
  const key = driver.keyFromUrl(url);
  if (!key) return false;

  await driver.remove(key);
  return true;
}

// True when a URL points at storage we manage. Used to decide whether a delete
// is even worth attempting.
export function isManagedUrl(url) {
  return driver.keyFromUrl(url) !== null;
}

// The receiving half of the local driver's upload handshake. Throws when the
// active driver is R2, where the browser PUTs to the bucket and this code path
// must never run.
export async function writeLocalUpload(key, body) {
  if (DRIVER !== "local") {
    throw new Error("Direct uploads are only accepted by the local driver.");
  }
  await local.write(key, body);
}
