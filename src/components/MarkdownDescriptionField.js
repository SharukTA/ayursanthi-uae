"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { uploadMedia } from "@/lib/storage/client";
import { Heading2, Heading3, List, ImagePlus, Eye, Pencil, Loader2 } from "lucide-react";
import { RichText } from "@/components/RichText";

// ─────────────────────────────────────────────────────────────────────────────
// Markdown editor for a product's full description. A plain <textarea> plus a
// toolbar whose buttons insert the small markdown subset understood by RichText
// / ProductDescription ("## " heading, "### " subheading, "- " bullet, and
// "![alt](url)" image) at the caret. Images upload through /api/admin/upload
// (admin-gated) — the same flow as MediaUrlField — and the returned URL is
// inserted as an image tag. A toggle shows a live preview.
// ─────────────────────────────────────────────────────────────────────────────
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml";

export function MarkdownDescriptionField({ value, onChange, disabled }) {
  const textareaRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(false);

  // Replaces the current selection (or inserts at the caret) and restores focus
  // with the caret placed just after what we inserted.
  function insertAtCaret(before, after = "", placeholder = "") {
    const el = textareaRef.current;
    const text = value || "";
    const start = el ? el.selectionStart : text.length;
    const end = el ? el.selectionEnd : text.length;
    const selected = text.slice(start, end) || placeholder;

    // Block-level tokens (headings, bullets, images) want to sit on their own
    // line, so ensure a preceding newline unless we're at the very start.
    const needsNewline = start > 0 && text[start - 1] !== "\n";
    const prefix = needsNewline ? "\n" + before : before;

    const next = text.slice(0, start) + prefix + selected + after + text.slice(end);
    onChange(next);

    // Re-focus and select the inserted placeholder so the admin can type over it.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = start + prefix.length;
      el.setSelectionRange(caret, caret + selected.length);
    });
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const toastId = toast.loading("Uploading image...");
    try {
      const url = await uploadMedia(file);
      insertAtCaret(`![${file.name.replace(/\.[^.]+$/, "")}](${url})\n`, "");
      toast.success("Image added to description.", { id: toastId });
    } catch (error) {
      toast.error(error.message || "Upload failed.", { id: toastId });
    } finally {
      setUploading(false);
    }
  }

  const busy = disabled || uploading;

  const toolBtn =
    "inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50";

  return (
    <div className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800 sm:col-span-2">
      <div className="flex items-center justify-between gap-2">
        <span>Full Description</span>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          disabled={disabled}
          className={toolBtn}
        >
          {preview ? <Pencil className="size-3" /> : <Eye className="size-3" />}
          {preview ? "Edit" : "Preview"}
        </button>
      </div>

      {!preview ? (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" onClick={() => insertAtCaret("## ", "", "Heading")} disabled={busy} className={toolBtn}>
              <Heading2 className="size-3" /> Heading
            </button>
            <button type="button" onClick={() => insertAtCaret("### ", "", "Subheading")} disabled={busy} className={toolBtn}>
              <Heading3 className="size-3" /> Subheading
            </button>
            <button type="button" onClick={() => insertAtCaret("- ", "", "List item")} disabled={busy} className={toolBtn}>
              <List className="size-3" /> Bullet
            </button>
            <label className={`cursor-pointer ${toolBtn} ${busy ? "pointer-events-none opacity-50" : ""}`}>
              {uploading ? <Loader2 className="size-3 animate-spin" /> : <ImagePlus className="size-3" />}
              {uploading ? "Uploading..." : "Add image"}
              <input type="file" accept={IMAGE_ACCEPT} onChange={handleFile} disabled={busy} className="hidden" />
            </label>
          </div>

          <textarea
            ref={textareaRef}
            rows={10}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={"Describe ingredients, benefits and usage.\n\n## Why this product\nWrite a paragraph here...\n\n- A key benefit\n- Another benefit\n\nUse the buttons above to add headings, bullets and images."}
            className="w-full min-w-0 rounded border border-input bg-white p-3 text-xs font-normal font-mono leading-5 outline-none transition focus:border-emerald-700 resize-y text-slate-700"
          />
          <span className="text-[11px] font-normal text-slate-500">
            Formatting: <code className="font-mono">## Heading</code>,{" "}
            <code className="font-mono">### Subheading</code>,{" "}
            <code className="font-mono">- bullet</code>, and images added with the button.
            A blank line separates paragraphs. Images render as full-width banners,
            or side-by-side with the text right next to them.
          </span>
        </>
      ) : (
        <div className="rounded border border-slate-200 bg-white p-4">
          {value?.trim() ? (
            <RichText body={value} className="text-sm leading-7 text-slate-700" />
          ) : (
            <p className="text-xs font-normal text-slate-400">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
