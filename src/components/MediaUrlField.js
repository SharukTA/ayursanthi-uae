"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import { Upload, Loader2, ImageIcon, Video } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Media URL input (image OR video) with a paste-or-upload alternative. Same
// behaviour as ImageUrlField, but the accepted file types and the preview adapt
// to `mediaType` ("IMAGE" | "VIDEO"). Used by the product gallery editor where a
// single row can be either an image or a video. Uploads go to /api/admin/upload,
// which already accepts both images and video containers.
// ─────────────────────────────────────────────────────────────────────────────
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml";
const VIDEO_ACCEPT = "video/mp4,video/webm,video/ogg,video/quicktime";

export function MediaUrlField({ label, placeholder, value, onChange, disabled, mediaType = "IMAGE" }) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const isVideo = mediaType === "VIDEO";

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;

    setUploading(true);
    const toastId = toast.loading(isVideo ? "Uploading video..." : "Uploading image...");
    try {
      // Upload straight to Vercel Blob from the browser; /api/admin/upload only
      // issues the (admin-gated) token. multipart handles large video files.
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        multipart: true,
        contentType: file.type,
      });
      onChange(blob.url);
      toast.success(isVideo ? "Video uploaded." : "Image uploaded.", { id: toastId });
    } catch (error) {
      toast.error(error.message || "Upload failed.", { id: toastId });
    } finally {
      setUploading(false);
    }
  }

  const busy = disabled || uploading;

  return (
    <div className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
      {label ? <label htmlFor={inputId}>{label}</label> : null}
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
          {uploading ? "Uploading..." : isVideo ? "Upload video" : "Upload image"}
          <input
            type="file"
            accept={isVideo ? VIDEO_ACCEPT : IMAGE_ACCEPT}
            onChange={handleFile}
            disabled={busy}
            className="hidden"
          />
        </label>
      </div>
      {value && !uploading ? (
        <span className="flex min-w-0 max-w-full items-center gap-2 text-[10px] font-normal text-emerald-700">
          {isVideo ? (
            <video src={value} className="size-8 shrink-0 rounded border border-slate-200 object-cover" muted />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="size-8 shrink-0 rounded border border-slate-200 object-cover" />
          )}
          <span className="flex min-w-0 items-center gap-1">
            {isVideo ? <Video className="size-3 shrink-0" /> : <ImageIcon className="size-3 shrink-0" />}
            <span className="truncate">{value}</span>
          </span>
        </span>
      ) : null}
    </div>
  );
}
