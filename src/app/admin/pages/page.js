"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  ArrowLeft,
  Loader2,
  Save,
  HelpCircle,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  ScrollText,
  Info,
  LayoutList,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { RichText } from "@/components/RichText";
import { useConfirm } from "@/components/ConfirmDialog";
import { TermsSectionEditor } from "@/components/TermsSectionEditor";

// What each editable slug actually is on the public site. Keeps the admin from
// having to guess which of the three fields lands where.
const PAGE_META = {
  about: {
    label: "About Us",
    icon: FileText,
    path: "/about",
    blurb:
      "The brand-story block on the About page. Extra sections such as Our Vision and Our Mission are optional and are managed separately, just below.",
    titleOptional: true,
    fields: {
      title: "Heading shown above the brand story — leave blank for no heading",
      subtitle: "Line under the “About Ayursanthi” page title",
      body: "Brand-story paragraphs",
    },
  },
  terms: {
    label: "Terms & Conditions",
    icon: ScrollText,
    path: "/terms",
    blurb:
      "The whole Terms page. Everything a customer reads there comes from the three fields below.",
    fields: {
      title: "Page title",
      subtitle: "Small line under the title (e.g. “Last updated: …”)",
      body: "Policy sections — start a line with “## ” for each numbered section",
    },
  },
};

function metaFor(slug) {
  return (
    PAGE_META[slug] || {
      label: slug,
      icon: FileText,
      path: `/${slug}`,
      blurb: "",
      fields: { title: "Heading", subtitle: "Subheading", body: "Body" },
    }
  );
}

export default function AdminPagesPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [sections, setSections] = useState([]);
  const [faqs, setFaqs] = useState([]);
  const [faqDefaults, setFaqDefaults] = useState([]);

  useEffect(() => {
    async function initPage() {
      try {
        const sessionRes = await fetch("/api/auth/session");
        const sessionData = await sessionRes.json();
        if (!sessionData.loggedIn || sessionData.session.role !== "ADMIN") {
          toast.error("Unauthorized administrative access.");
          router.push("/login");
          return;
        }
        setAuthChecked(true);
        await Promise.all([loadPages(), loadFaqs()]);
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  async function loadPages() {
    const res = await fetch("/api/admin/pages");
    const data = await res.json();
    setPages(data.pages || []);
    setSections(data.sections || []);
  }
  async function loadFaqs() {
    const res = await fetch("/api/admin/faq");
    const data = await res.json();
    setFaqs(data.items || []);
    setFaqDefaults(data.defaults || []);
  }

  if (loading || !authChecked) {
    return (
      <main className="min-h-screen bg-slate-50 text-white flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-semibold text-slate-500">Accessing administrative dashboard...</p>
        </div>
        <SiteFooter />
      </main>
    );
  }

  const activeFaqs = faqs.filter((f) => f.isActive).length;
  // Optional About blocks that are actually on the public page right now.
  const liveSections = sections.filter((s) => s.added && s.isActive).length;

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="bg-slate-950 py-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageReveal>
            <Link href="/admin" className="inline-flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white mb-2">
              <ArrowLeft className="size-3" />
              Console Home
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <FileText className="size-7 text-emerald-400" />
              Pages &amp; FAQ
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Everything here is site copy: the <strong className="font-semibold text-white">About Us</strong> story
              and its optional extra sections, the <strong className="font-semibold text-white">Terms &amp; Conditions</strong> policy,
              and the <strong className="font-semibold text-white">FAQ</strong> list.
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full grid gap-8">
        {/* What lives on this screen */}
        <FadeIn className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {pages.find((p) => p.slug === "about") && (() => {
            const page = pages.find((p) => p.slug === "about");
            const meta = metaFor(page.slug);
            const Icon = meta.icon;
            return (
              <SummaryCard
                key={page.slug}
                icon={Icon}
                label={meta.label}
                anchor={`#page-${page.slug}`}
                livePath={meta.path}
                status={page.customized ? "Edited by you" : "Built-in default text"}
                statusTone={page.customized ? "text-emerald-700 bg-emerald-50" : "text-slate-500 bg-slate-100"}
              />
            );
          })()}
          <SummaryCard
            icon={LayoutList}
            label="About sections"
            anchor="#about-sections"
            livePath="/about"
            status={
              liveSections === 0
                ? "None added — optional"
                : `${liveSections} section${liveSections === 1 ? "" : "s"} on the page`
            }
            statusTone={liveSections === 0 ? "text-slate-500 bg-slate-100" : "text-emerald-700 bg-emerald-50"}
          />
          {pages.find((p) => p.slug === "terms") && (() => {
            const page = pages.find((p) => p.slug === "terms");
            const meta = metaFor(page.slug);
            const Icon = meta.icon;
            return (
              <SummaryCard
                key={page.slug}
                icon={Icon}
                label={meta.label}
                anchor={`#page-${page.slug}`}
                livePath={meta.path}
                status={page.customized ? "Edited by you" : "Built-in default text"}
                statusTone={page.customized ? "text-emerald-700 bg-emerald-50" : "text-slate-500 bg-slate-100"}
              />
            );
          })()}
          {pages
            .filter((p) => p.slug !== "about" && p.slug !== "terms")
            .map((page) => {
              const meta = metaFor(page.slug);
              const Icon = meta.icon;
              return (
                <SummaryCard
                  key={page.slug}
                  icon={Icon}
                  label={meta.label}
                  anchor={`#page-${page.slug}`}
                  livePath={meta.path}
                  status={page.customized ? "Edited by you" : "Built-in default text"}
                  statusTone={page.customized ? "text-emerald-700 bg-emerald-50" : "text-slate-500 bg-slate-100"}
                />
              );
            })}
          <SummaryCard
            icon={HelpCircle}
            label="FAQ"
            anchor="#faq"
            livePath="/faq"
            status={
              faqs.length === 0
                ? `${faqDefaults.length} built-in defaults`
                : `${activeFaqs} of ${faqs.length} question${faqs.length === 1 ? "" : "s"} visible`
            }
            statusTone={faqs.length === 0 ? "text-slate-500 bg-slate-100" : "text-emerald-700 bg-emerald-50"}
          />
        </FadeIn>

        {/* 1. Core About Us story editor */}
        {pages.find((p) => p.slug === "about") && (
          <PageEditor
            key="about"
            page={pages.find((p) => p.slug === "about")}
            onSaved={loadPages}
          />
        )}

        {/* 2. Optional About page sections */}
        <AboutSectionsManager sections={sections} onChanged={loadPages} />

        {/* 3. Terms & Conditions builder */}
        {pages.find((p) => p.slug === "terms") && (
          <TermsSectionEditor
            key="terms"
            page={pages.find((p) => p.slug === "terms")}
            onSaved={loadPages}
          />
        )}

        {/* Any extra pages if added in the future */}
        {pages
          .filter((p) => p.slug !== "about" && p.slug !== "terms")
          .map((page) => (
            <PageEditor key={page.slug} page={page} onSaved={loadPages} />
          ))}

        {/* 4. FAQ Manager */}
        <FaqManager faqs={faqs} defaults={faqDefaults} onChanged={loadFaqs} />
      </section>

      <SiteFooter />
    </main>
  );
}

function SummaryCard({ icon: Icon, label, anchor, livePath, status, statusTone }) {
  return (
    <a
      href={anchor}
      className="rounded-md border border-border bg-white p-4 shadow-sm transition hover:border-emerald-700 hover:shadow"
    >
      <span className="flex items-center gap-2 text-sm font-bold text-slate-950">
        <Icon className="size-4 text-emerald-700" />
        {label}
      </span>
      <span className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${statusTone}`}>
        {status}
      </span>
      <span className="mt-2 block text-[10px] font-semibold text-slate-400">Live at {livePath}</span>
    </a>
  );
}

function PageEditor({ page, onSaved }) {
  const meta = metaFor(page.slug);
  const Icon = meta.icon;
  const [title, setTitle] = useState(page.title || "");
  const [subtitle, setSubtitle] = useState(page.subtitle || "");
  const [body, setBody] = useState(page.body || "");
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading("Saving page...");
    try {
      const res = await fetch(`/api/admin/pages/${page.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subtitle, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save page.");
      toast.success("Page saved.", { id: toastId });
      await onSaved();
    } catch (error) {
      toast.error(error.message || "Error saving page.", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  return (
    <FadeIn id={`page-${page.slug}`} className="scroll-mt-6 rounded-md border border-border bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
          <Icon className="size-5 text-emerald-700" />
          {meta.label}
          <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${page.customized ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
            {page.customized ? "EDITED" : "DEFAULT TEXT"}
          </span>
        </h2>
        <Link href={meta.path} target="_blank" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline">
          <ExternalLink className="size-3" />
          View {meta.path}
        </Link>
      </div>

      {meta.blurb ? (
        <p className="mt-3 flex items-start gap-2 rounded border border-slate-200 bg-slate-50/60 p-3 text-[11px] leading-5 text-slate-600">
          <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
          {meta.blurb}
        </p>
      ) : null}

      <form onSubmit={handleSave} className="mt-5 grid gap-4">
        <label className="grid gap-1 text-xs font-semibold text-slate-800">
          Heading {meta.titleOptional ? null : "*"}
          <span className="text-[10px] font-normal text-slate-400">{meta.fields.title}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            className="mt-1 w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
          />
        </label>
        <label className="grid gap-1 text-xs font-semibold text-slate-800">
          Subheading
          <span className="text-[10px] font-normal text-slate-400">{meta.fields.subtitle}</span>
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            disabled={saving}
            className="mt-1 w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
          />
        </label>

        <div className="grid gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Body *</span>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-bold text-slate-600 hover:border-emerald-700 hover:text-emerald-700"
            >
              <Eye className="size-3" />
              {preview ? "Back to editing" : "Preview"}
            </button>
          </div>
          <span className="text-[10px] font-normal text-slate-400">{meta.fields.body}</span>

          {preview ? (
            <div className="mt-1 rounded border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-lg font-bold text-slate-950">{title || <em className="text-slate-400">No heading</em>}</p>
              {subtitle ? <p className="mt-1 text-[11px] font-semibold text-slate-500">{subtitle}</p> : null}
              <RichText body={body} className="mt-4 text-xs leading-6 text-slate-700" />
            </div>
          ) : (
            <textarea
              rows={12}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              disabled={saving}
              className="mt-1 w-full rounded border border-input bg-white p-3 text-xs font-normal leading-6 text-slate-900 outline-none transition focus:border-emerald-700"
            />
          )}
          <span className="text-[10px] font-normal text-slate-400">
            Blank line = new paragraph. Start a line with &quot;## &quot; for a heading, &quot;- &quot; for a bullet.
          </span>
        </div>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="h-9 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold px-5">
            {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
            Save {meta.label}
          </Button>
        </div>
      </form>
    </FadeIn>
  );
}

// Optional extra blocks on /about (Our Vision, Our Mission). Each one only
// exists on the public page once it has been saved here — an untouched section
// renders nothing at all, which is the intended default.
function AboutSectionsManager({ sections, onChanged }) {
  const [confirm, confirmDialog] = useConfirm();

  return (
    <FadeIn id="about-sections" className="scroll-mt-6 rounded-md border border-border bg-white p-6 shadow-sm">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
          <LayoutList className="size-5 text-emerald-700" />
          About page sections
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
            OPTIONAL
          </span>
        </h2>
        <Link href="/about" target="_blank" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline">
          <ExternalLink className="size-3" />
          View /about
        </Link>
      </div>

      <p className="mt-3 flex items-start gap-2 rounded border border-slate-200 bg-slate-50/60 p-3 text-[11px] leading-5 text-slate-600">
        <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        These blocks appear under the brand story, in the order shown. They are entirely optional — leave one
        untouched and it never appears on the site. Only the text is required; skip the heading and the block
        renders as plain paragraphs. Use the eye icon to take a block off temporarily, or remove it to go back
        to nothing.
      </p>

      <div className="mt-5 grid gap-4">
        {sections.map((section) => (
          <OptionalSectionEditor
            key={section.slug}
            section={section}
            confirm={confirm}
            onChanged={onChanged}
          />
        ))}
      </div>
    </FadeIn>
  );
}

function OptionalSectionEditor({ section, confirm, onChanged }) {
  const [title, setTitle] = useState(section.title || "");
  const [body, setBody] = useState(section.body || "");
  const [saving, setSaving] = useState(false);

  const live = section.added && section.isActive;

  async function handleSave(e) {
    e.preventDefault();
    if (!body.trim()) {
      toast.error("Add some text for this section, or remove it.");
      return;
    }
    setSaving(true);
    const toastId = toast.loading("Saving section...");
    try {
      const res = await fetch(`/api/admin/pages/${section.slug}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body: body.trim(), isActive: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save section.");
      toast.success(`${section.label} is now on the About page.`, { id: toastId });
      await onChanged();
    } catch (error) {
      toast.error(error.message || "Error saving section.", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle() {
    try {
      const res = await fetch(`/api/admin/pages/${section.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !section.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update section.");
      await onChanged();
    } catch (error) {
      toast.error(error.message);
    }
  }

  async function handleRemove() {
    const ok = await confirm({
      title: `Remove “${section.label}”?`,
      description:
        "The section and its text are deleted and the About page goes back to not showing it at all. You can always add it again later.",
      confirmLabel: "Remove section",
    });
    if (!ok) return;
    const toastId = toast.loading("Removing...");
    try {
      const res = await fetch(`/api/admin/pages/${section.slug}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove section.");
      setTitle("");
      setBody("");
      toast.success("Section removed.", { id: toastId });
      await onChanged();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  return (
    <form onSubmit={handleSave} className="grid gap-3 rounded border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
          {section.label}
          <span
            className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${
              live
                ? "bg-emerald-50 text-emerald-700"
                : section.added
                  ? "bg-amber-50 text-amber-800"
                  : "bg-slate-100 text-slate-500"
            }`}
          >
            {live ? "ON THE PAGE" : section.added ? "HIDDEN" : "NOT ADDED"}
          </span>
        </h3>

        {section.added ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggle}
              title={section.isActive ? "Visible on site — click to hide" : "Hidden — click to show"}
              className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${section.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`}
            >
              {section.isActive ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              title="Remove section"
              className="text-slate-400 hover:text-rose-700"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        disabled={saving}
        placeholder={`Heading (optional) — e.g. “${section.suggestedTitle}”`}
        className="w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
      />
      <textarea
        rows={6}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        disabled={saving}
        placeholder="Paragraphs for this section. Blank line = new paragraph."
        className="w-full rounded border border-input bg-white p-3 text-xs font-normal leading-6 text-slate-900 outline-none transition focus:border-emerald-700"
      />

      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="h-9 bg-emerald-700 hover:bg-emerald-800 rounded text-[11px] font-semibold px-4">
          {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
          {section.added ? "Save changes" : `Add ${section.label}`}
        </Button>
      </div>
    </form>
  );
}

function FaqManager({ faqs, defaults = [], onChanged }) {
  const [confirm, confirmDialog] = useConfirm();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      toast.error("Question and answer are required.");
      return;
    }
    setSaving(true);
    const toastId = toast.loading("Adding FAQ...");
    try {
      const res = await fetch("/api/admin/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: question.trim(), answer: answer.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add FAQ.");
      toast.success("FAQ added.", { id: toastId });
      setQuestion("");
      setAnswer("");
      await onChanged();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(item) {
    try {
      await fetch(`/api/admin/faq/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      await onChanged();
    } catch {
      toast.error("Failed to update FAQ.");
    }
  }

  async function handleDelete(item) {
    const ok = await confirm({
      title: "Delete FAQ item?",
      description: "This FAQ question and answer will be permanently removed. This cannot be undone.",
      confirmLabel: "Delete FAQ",
    });
    if (!ok) return;
    const toastId = toast.loading("Deleting...");
    try {
      const res = await fetch(`/api/admin/faq/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete FAQ.");
      toast.success("FAQ deleted.", { id: toastId });
      await onChanged();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  return (
    <FadeIn id="faq" className="scroll-mt-6 rounded-md border border-border bg-white p-6 shadow-sm">
      {confirmDialog}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
          <HelpCircle className="size-5 text-emerald-700" />
          FAQ ({faqs.length})
        </h2>
        <Link href="/faq" target="_blank" className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline">
          <ExternalLink className="size-3" />
          View /faq
        </Link>
      </div>

      <p className="mt-3 flex items-start gap-2 rounded border border-slate-200 bg-slate-50/60 p-3 text-[11px] leading-5 text-slate-600">
        <Info className="mt-0.5 size-3.5 shrink-0 text-slate-400" />
        Questions added here appear on the public FAQ page in the order they were added. Hide one with the
        eye icon to take it off the site without deleting it.
      </p>

      <form onSubmit={handleAdd} className="mt-5 grid gap-3 rounded border border-slate-200 bg-slate-50/60 p-4">
        <h3 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
          <Plus className="size-4 text-emerald-700" />
          Add FAQ
        </h3>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={saving}
          placeholder="Question"
          className="w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700"
        />
        <textarea
          rows={3}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          disabled={saving}
          placeholder="Answer"
          className="w-full rounded border border-input bg-white p-3 text-xs font-normal leading-6 text-slate-900 outline-none focus:border-emerald-700 resize-none"
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="h-9 bg-slate-900 hover:bg-slate-800 rounded text-[11px] font-semibold px-4">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : "Add FAQ"}
          </Button>
        </div>
      </form>

      {faqs.length === 0 ? (
        <div className="mt-5">
          <p className="rounded border border-amber-200 bg-amber-50 p-3 text-[11px] font-semibold leading-5 text-amber-900">
            No FAQ items saved yet — the public page is showing these {defaults.length} built-in questions.
            Add your own above and they replace the whole list.
          </p>
          <ul className="mt-3 grid gap-2">
            {defaults.map((item, idx) => (
              <li key={idx} className="rounded border border-dashed border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-700">{item.question}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">{item.answer}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <ul className="mt-5 grid gap-2">
          {faqs.map((item, idx) => (
            <li key={item.id} className="flex items-start gap-3 rounded border border-slate-200 p-3">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-extrabold text-slate-600">
                {idx + 1}
              </span>
              <details className="min-w-0 flex-1 group">
                <summary className="cursor-pointer list-none text-xs font-bold text-slate-900">
                  {item.question}
                  <span className="ml-1 text-[10px] font-semibold text-emerald-700 group-open:hidden">show answer</span>
                </summary>
                <p className="mt-1.5 whitespace-pre-line text-[11px] leading-5 text-slate-600">{item.answer}</p>
              </details>
              <button onClick={() => handleToggle(item)} className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`} title={item.isActive ? "Visible on site — click to hide" : "Hidden — click to show"}>
                {item.isActive ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </button>
              <button onClick={() => handleDelete(item)} className="shrink-0 text-slate-400 hover:text-rose-700" title="Delete">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </FadeIn>
  );
}
