"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ScrollText,
  ExternalLink,
  Info,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Eye,
  Save,
  Loader2,
  Code,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { parseTermsSections, serializeTermsSections } from "@/lib/terms-parser";
import { FadeIn } from "@/components/Animated";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import { useConfirm } from "@/components/ConfirmDialog";

export function TermsSectionEditor({ page, onSaved }) {
  const [confirm, confirmDialog] = useConfirm();
  const [title, setTitle] = useState(() => page.title || "Terms of Service");
  const [subtitle, setSubtitle] = useState(() => page.subtitle || `Last updated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`);
  const [sections, setSections] = useState(() => {
    const parsed = parseTermsSections(page.body || "");
    return parsed.length > 0
      ? parsed
      : [{ id: "sec-1", title: "1. Acceptance of Terms", body: "By accessing and using this site, you agree to comply with these terms." }];
  });
  const [rawBody, setRawBody] = useState(() => page.body || "");
  const [mode, setMode] = useState("builder"); // 'builder' | 'raw'
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  // When switching modes, sync state
  const handleModeToggle = (targetMode) => {
    if (targetMode === "raw") {
      setRawBody(serializeTermsSections(sections));
    } else {
      const parsed = parseTermsSections(rawBody);
      if (parsed.length > 0) setSections(parsed);
    }
    setMode(targetMode);
  };

  const handleAddSection = () => {
    const nextNum = sections.length + 1;
    const newSec = {
      id: `sec-new-${Date.now()}`,
      title: `${nextNum}. New Section Title`,
      body: "Enter section content paragraphs here...",
    };
    setSections((prev) => [...prev, newSec]);
  };

  const handleUpdateSection = (index, field, value) => {
    setSections((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleMove = (index, direction) => {
    if (
      (direction === -1 && index === 0) ||
      (direction === 1 && index === sections.length - 1)
    ) {
      return;
    }
    setSections((prev) => {
      const copy = [...prev];
      const targetIndex = index + direction;
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      return copy;
    });
  };

  const handleDeleteSection = async (index) => {
    const sec = sections[index];
    const ok = await confirm({
      title: `Delete Section "${sec.title || idx + 1}"?`,
      description: "Are you sure you want to remove this section from the Terms & Conditions?",
      confirmLabel: "Delete Section",
    });
    if (!ok) return;

    setSections((prev) => prev.filter((_, i) => i !== index));
  };

  async function handleSave(e) {
    e.preventDefault();

    const finalBody =
      mode === "builder" ? serializeTermsSections(sections) : rawBody.trim();

    if (!finalBody) {
      toast.error("Terms & Conditions body text cannot be empty.");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Saving Terms & Conditions...");

    try {
      const res = await fetch(`/api/admin/pages/${page.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitle, body: finalBody }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save Terms & Conditions.");

      toast.success("Amazon-Style Terms & Conditions saved successfully!", { id: toastId });
      await onSaved();
    } catch (error) {
      toast.error(error.message || "Error saving Terms.", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  const effectiveBody = mode === "builder" ? serializeTermsSections(sections) : rawBody;

  return (
    <FadeIn id="page-terms" className="scroll-mt-6 rounded-md border border-slate-200 bg-white p-6 shadow-xs">
      {confirmDialog}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
          <ScrollText className="size-5 text-emerald-700" />
          Terms &amp; Conditions Builder
          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
            SECTION CMS
          </span>
        </h2>

        <div className="flex items-center gap-3">
          <Link
            href="/terms"
            target="_blank"
            className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline"
          >
            <ExternalLink className="size-3.5" />
            Live Preview /terms
          </Link>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-2 rounded border border-slate-200 bg-slate-50/60 p-3 text-xs leading-5 text-slate-600">
        <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        Manage your Terms &amp; Conditions as individual sections. The storefront will automatically generate an Amazon-style sticky Table of Contents, section anchor links, and clause search for your customers.
      </p>

      {/* Editor Controls Bar */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-100 p-2 text-xs">
        <div className="flex items-center gap-1.5 bg-white p-1 rounded border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={() => handleModeToggle("builder")}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition ${
              mode === "builder"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="size-3.5" />
            Section Builder
          </button>
          <button
            type="button"
            onClick={() => handleModeToggle("raw")}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition ${
              mode === "raw"
                ? "bg-slate-900 text-white shadow-2xs"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            <Code className="size-3.5" />
            Raw Markdown Mode
          </button>
        </div>

        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="inline-flex items-center gap-1.5 rounded border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-700 hover:text-emerald-700 transition"
        >
          <Eye className="size-3.5" />
          {preview ? "Back to Editor" : "Live Storefront Preview"}
        </button>
      </div>

      <form onSubmit={handleSave} className="mt-5 grid gap-5">
        {/* Document Title & Subtitle */}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-slate-800">
            Document Title *
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-emerald-700"
            />
          </label>

          <label className="grid gap-1 text-xs font-semibold text-slate-800">
            Subtitle / Effective Date
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              disabled={saving}
              placeholder="e.g. Last updated: July 30, 2026"
              className="mt-1 w-full rounded border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 outline-none transition focus:border-emerald-700"
            />
          </label>
        </div>

        {/* Live Storefront Preview Mode */}
        {preview ? (
          <div className="rounded-lg border border-slate-300 bg-slate-50 p-5">
            <h4 className="text-xs font-bold uppercase text-slate-400 mb-3">Amazon Storefront Live Preview</h4>
            <div className="rounded border border-slate-200 bg-white p-5">
              <h3 className="text-xl font-bold text-slate-900">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
              
              <div className="mt-4 pt-4 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-400 uppercase mb-2">TOC Jump Links Preview</p>
                <div className="flex flex-wrap gap-2 mb-6">
                  {sections.map((s, idx) => (
                    <span key={idx} className="rounded bg-slate-100 border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      {s.title || `Section ${idx + 1}`}
                    </span>
                  ))}
                </div>

                <RichText body={effectiveBody} className="prose-xs text-slate-700" />
              </div>
            </div>
          </div>
        ) : mode === "builder" ? (
          /* Section Builder View */
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900">
                Terms Sections ({sections.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Use arrows to reorder sections.
              </span>
            </div>

            {sections.map((sec, idx) => (
              <div
                key={sec.id || idx}
                className="group relative grid gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-4 transition hover:border-slate-300 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded bg-slate-900 text-[10px] font-extrabold text-white">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      Section {idx + 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => handleMove(idx, -1)}
                      className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                      title="Move section up"
                    >
                      <ArrowUp className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === sections.length - 1}
                      onClick={() => handleMove(idx, 1)}
                      className="rounded p-1 text-slate-400 hover:bg-white hover:text-slate-700 disabled:opacity-30"
                      title="Move section down"
                    >
                      <ArrowDown className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSection(idx)}
                      className="ml-2 rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                      title="Delete section"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                <label className="grid gap-1 text-xs font-semibold text-slate-800">
                  Section Title (numbered)
                  <input
                    type="text"
                    value={sec.title}
                    onChange={(e) => handleUpdateSection(idx, "title", e.target.value)}
                    placeholder={`e.g. ${idx + 1}. Title of Section`}
                    className="w-full rounded border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-700"
                  />
                </label>

                <label className="grid gap-1 text-xs font-semibold text-slate-800">
                  Section Content / Paragraphs
                  <textarea
                    rows={4}
                    value={sec.body}
                    onChange={(e) => handleUpdateSection(idx, "body", e.target.value)}
                    placeholder="Enter clause paragraphs, bullet points (- point), etc..."
                    className="w-full rounded border border-slate-300 bg-white p-3 text-xs leading-5 text-slate-900 outline-none focus:border-emerald-700 resize-y"
                  />
                </label>
              </div>
            ))}

            <Button
              type="button"
              onClick={handleAddSection}
              variant="outline"
              className="h-10 w-full border-dashed border-slate-300 text-xs font-semibold text-slate-700 hover:border-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
            >
              <Plus className="size-4 mr-1 text-emerald-600" />
              Add New Section
            </Button>
          </div>
        ) : (
          /* Raw Markdown View */
          <div className="grid gap-1">
            <span className="text-xs font-semibold text-slate-800">Raw Body Markdown</span>
            <textarea
              rows={14}
              value={rawBody}
              onChange={(e) => setRawBody(e.target.value)}
              disabled={saving}
              className="w-full rounded border border-slate-300 bg-white p-3 text-xs leading-6 text-slate-900 outline-none focus:border-emerald-700 font-mono"
            />
            <span className="text-[10px] text-slate-400">
              Start lines with &quot;## &quot; to denote new section titles.
            </span>
          </div>
        )}

        {/* Submit Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <span className="text-xs text-slate-500">
            Changes will immediately reflect on the live /terms page.
          </span>
          <Button
            type="submit"
            disabled={saving}
            className="h-9 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold px-6"
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin mr-1.5" />
            ) : (
              <Save className="size-3.5 mr-1.5" />
            )}
            Save Terms &amp; Conditions
          </Button>
        </div>
      </form>
    </FadeIn>
  );
}
