// ─────────────────────────────────────────────────────────────────────────────
// Browser half of the upload handshake. Every admin media field calls this:
//
//   const url = await uploadMedia(file);
//   onChange(url);
//
// Step 1 asks /api/admin/upload (admin-gated) where to put the file; step 2
// sends the bytes to wherever it said — Cloudflare R2's presigned URL in
// production, our own route in local dev. Which one it is never reaches this
// module, so switching STORAGE_DRIVER needs no client change.
//
// Safe to import from client components: no node builtins, no secrets.
// ─────────────────────────────────────────────────────────────────────────────

async function messageFrom(response, fallback) {
  try {
    const body = await response.json();
    return body?.message || fallback;
  } catch {
    return fallback;
  }
}

export async function uploadMedia(file) {
  const planResponse = await fetch("/api/admin/upload", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });

  if (!planResponse.ok) {
    throw new Error(await messageFrom(planResponse, "Unable to start upload."));
  }

  const { publicUrl, upload } = await planResponse.json();

  const putResponse = await fetch(upload.url, {
    method: upload.method,
    headers: upload.headers,
    body: file,
  });

  if (!putResponse.ok) {
    // A 403 here on R2 almost always means the bucket's CORS policy does not
    // list this origin, or the browser sent a Content-Type other than the one
    // the URL was signed for.
    throw new Error(
      await messageFrom(putResponse, `Upload failed (${putResponse.status}).`)
    );
  }

  return publicUrl;
}
