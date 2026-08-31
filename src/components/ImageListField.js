"use client";

import { useState } from "react";
import { toast } from "sonner";
import { uploadMedia } from "@/lib/storage/client";
import { ArrowLeft, ArrowRight, ImagePlus, Loader2, Star, Trash2, Upload } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// An ordered list of images, uploaded or pasted.
//
// The multi-image sibling of ImageUrlField, for the places where one picture is
// not enough — a prize gallery being the first. Two things it does that a
// repeated ImageUrlField would not:
//
//   • Multi-select upload. `multiple` on the file input plus a sequential loop,
//     so an admin picks six photographs of a car once rather than opening the
//     picker six times.
//   • Explicit ORDER, with the first slot marked as the cover. Which image is
//     the cover is the single decision that matters here — it is what every
//     card, thumbnail and email shows — so it is stated on the tile rather than
//     left as a convention about array position that nobody can see.
//
// Reordering is arrow buttons, not drag-and-drop. Dragging needs pointer, touch
// and keyboard paths to all work to be usable at all, and arrows are correct in
// every one of them for free.
// ─────────────────────────────────────────────────────────────────────────────

const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml";

/**
 * @param {object} props
 * @param {string} props.label
 * @param {string[]} props.value     image URLs, in display order
 * @param {(urls: string[]) => void} props.onChange
 * @param {boolean} [props.disabled]
 * @param {string} [props.hint]
 */
export function ImageListField({ label, value, onChange, disabled, hint }) {
  const [uploading, setUploading] = useState(false);
  const [pasted, setPasted] = useState("");

  const urls = Array.isArray(value) ? value : [];
  const busy = disabled || uploading;

  function add(url) {
    const trimmed = String(url || "").trim();
    if (!trimmed) return;
    // Silently ignoring a duplicate rather than adding it: the same photograph
    // twice in a gallery reads as a bug in the page, not a mistake in the form.
    if (urls.includes(trimmed)) {
      toast.error("That image is already in the list.");
      return;
    }
    onChange([...urls, trimmed]);
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // allow re-picking the same files later
    if (files.length === 0) return;

    setUploading(true);
    const toastId = toast.loading(
      files.length === 1 ? "Uploading image..." : `Uploading 1 of ${files.length}...`
    );

    // Sequential, not Promise.all. Each upload is a presigned PUT of the whole
    // file straight to object storage, and firing six large ones at once on a
    // phone connection is how you get a timeout rather than six images. It also
    // makes the progress count honest and keeps the resulting order the same as
    // the order the admin picked them in.
    const uploaded = [];
    try {
      for (const [index, file] of files.entries()) {
        toast.loading(`Uploading ${index + 1} of ${files.length}...`, { id: toastId });
        uploaded.push(await uploadMedia(file));
      }
      toast.success(
        uploaded.length === 1 ? "Image uploaded." : `${uploaded.length} images uploaded.`,
        { id: toastId }
      );
    } catch (error) {
      // Whatever got through is kept. Losing four successful uploads because the
      // fifth failed would mean doing all five again.
      toast.error(
        uploaded.length > 0
          ? `${uploaded.length} uploaded, then: ${error.message || "upload failed."}`
          : error.message || "Upload failed.",
        { id: toastId }
      );
    } finally {
      if (uploaded.length > 0) {
        onChange([...urls, ...uploaded.filter((url) => !urls.includes(url))]);
      }
      setUploading(false);
    }
  }

  function move(from, to) {
    if (to < 0 || to >= urls.length) return;
    const next = [...urls];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }

  return (
    <div className="grid gap-2 text-xs font-semibold text-slate-800">
      <span>
        {label}
        {urls.length > 0 ? (
          <span className="ml-1.5 font-normal text-slate-400">
            {urls.length} image{urls.length === 1 ? "" : "s"}
          </span>
        ) : null}
      </span>

      {urls.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {urls.map((url, index) => (
            <div
              key={url}
              className="relative w-24 overflow-hidden rounded border border-slate-200 bg-white"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-20 w-full object-cover" />

              {index === 0 ? (
                <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-amber-400 px-1 py-0.5 text-[8px] font-black uppercase text-slate-950">
                  <Star className="size-2" />
                  Cover
                </span>
              ) : null}

              <div className="flex items-center justify-between border-t border-slate-100 px-1 py-0.5">
                <button
                  type="button"
                  onClick={() => move(index, index - 1)}
                  disabled={busy || index === 0}
                  title="Move earlier"
                  className="text-slate-500 disabled:text-slate-200"
                >
                  <ArrowLeft className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => move(index, index + 1)}
                  disabled={busy || index === urls.length - 1}
                  title="Move later"
                  className="text-slate-500 disabled:text-slate-200"
                >
                  <ArrowRight className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(urls.filter((_, i) => i !== index))}
                  disabled={busy}
                  title="Remove"
                  className="text-rose-600 disabled:text-slate-200"
                >
                  <Trash2 className="size-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-[10px] font-normal text-slate-500">
          No images yet. The first one you add becomes the cover.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 ${
            busy ? "pointer-events-none opacity-60" : ""
          }`}
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {uploading ? "Uploading..." : "Upload images"}
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            onChange={handleFiles}
            disabled={busy}
            className="hidden"
          />
        </label>

        <span className="text-[10px] font-normal text-slate-400">or paste a URL</span>
        <input
          type="text"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          // Enter would otherwise submit the surrounding form and save the whole
          // prize with the URL still sitting unadded in this box.
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            add(pasted);
            setPasted("");
          }}
          disabled={busy}
          placeholder="https://..."
          className="min-h-8 min-w-0 flex-1 rounded border border-input bg-white px-2 text-[11px] font-normal outline-none focus:border-emerald-700"
        />
        <button
          type="button"
          onClick={() => {
            add(pasted);
            setPasted("");
          }}
          disabled={busy || !pasted.trim()}
          className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <ImagePlus className="size-3.5" />
          Add
        </button>
      </div>

      {hint ? <span className="text-[10px] font-normal text-slate-500">{hint}</span> : null}
    </div>
  );
}
