"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { uploadMedia } from "@/lib/storage/client";
import { Upload, Loader2, ImageIcon } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Image URL input with a "choose a file" alternative. Pasting a URL still works;
// picking a local image uploads it to /api/admin/upload and drops the returned
// public URL into the same field. Mirrors the field used in the Home Builder so
// the admin gets the same paste-or-upload behaviour everywhere.
// ─────────────────────────────────────────────────────────────────────────────
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml";

export function ImageUrlField({ label, placeholder, value, onChange, disabled }) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;

    setUploading(true);
    const toastId = toast.loading("Uploading image...");
    try {
      // Uploads straight to object storage from the browser; /api/admin/upload
      // only issues the (admin-gated) target, so there's no serverless body limit.
      onChange(await uploadMedia(file));
      toast.success("Image uploaded.", { id: toastId });
    } catch (error) {
      toast.error(error.message || "Upload failed.", { id: toastId });
    } finally {
      setUploading(false);
    }
  }

  const busy = disabled || uploading;

  return (
    <div className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={busy}
        placeholder={placeholder}
        className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
      />
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-normal text-slate-400">or</span>
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 ${busy ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {uploading ? "Uploading..." : "Upload from computer"}
          <input
            type="file"
            accept={IMAGE_ACCEPT}
            onChange={handleFile}
            disabled={busy}
            className="hidden"
          />
        </label>
      </div>
      {value && !uploading ? (
        <span className="flex min-w-0 max-w-full items-center gap-2 text-[10px] font-normal text-emerald-700">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="size-8 shrink-0 rounded border border-slate-200 object-cover" />
          <span className="flex min-w-0 items-center gap-1">
            <ImageIcon className="size-3 shrink-0" />
            <span className="truncate">{value}</span>
          </span>
        </span>
      ) : null}
    </div>
  );
}
