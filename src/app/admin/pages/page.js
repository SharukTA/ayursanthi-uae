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
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";

export default function AdminPagesPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pages, setPages] = useState([]);
  const [faqs, setFaqs] = useState([]);

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
  }
  async function loadFaqs() {
    const res = await fetch("/api/admin/faq");
    const data = await res.json();
    setFaqs(data.items || []);
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
              Edit the About and Terms page text, and manage the FAQ list.
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full grid gap-8">
        {pages.map((page) => (
          <PageEditor key={page.slug} page={page} onSaved={loadPages} />
        ))}

        <FaqManager faqs={faqs} onChanged={loadFaqs} />
      </section>

      <SiteFooter />
    </main>
  );
}

function PageEditor({ page, onSaved }) {
  const [title, setTitle] = useState(page.title || "");
  const [subtitle, setSubtitle] = useState(page.subtitle || "");
  const [body, setBody] = useState(page.body || "");
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
    <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
          <FileText className="size-5 text-emerald-700" />
          <span className="capitalize">{page.slug}</span> page
        </h2>
        <Link href={`/${page.slug}`} target="_blank" className="text-[11px] font-semibold text-emerald-700 hover:underline">
          View live →
        </Link>
      </div>

      <form onSubmit={handleSave} className="mt-5 grid gap-4">
        <label className="grid gap-2 text-xs font-semibold text-slate-800">
          Heading *
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={saving}
            className="w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
          />
        </label>
        <label className="grid gap-2 text-xs font-semibold text-slate-800">
          Subheading
          <input
            type="text"
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            disabled={saving}
            className="w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
          />
        </label>
        <label className="grid gap-2 text-xs font-semibold text-slate-800">
          Body *
          <textarea
            rows={10}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={saving}
            className="w-full rounded border border-input bg-white p-3 text-xs font-normal leading-6 text-slate-900 outline-none transition focus:border-emerald-700"
          />
          <span className="text-[10px] font-normal text-slate-400">
            Blank line = new paragraph. Start a line with &quot;## &quot; for a heading, &quot;- &quot; for a bullet.
          </span>
        </label>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="h-9 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold px-5">
            {saving ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <Save className="size-3.5 mr-1.5" />}
            Save Page
          </Button>
        </div>
      </form>
    </FadeIn>
  );
}

function FaqManager({ faqs, onChanged }) {
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
    <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
      {confirmDialog}
      <h2 className="text-base font-bold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
        <HelpCircle className="size-5 text-emerald-700" />
        FAQ ({faqs.length})
      </h2>

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
        <p className="mt-5 text-sm text-slate-500 italic text-center py-6">No FAQ items yet.</p>
      ) : (
        <ul className="mt-5 grid gap-2">
          {faqs.map((item) => (
            <li key={item.id} className="flex items-start gap-3 rounded border border-slate-200 p-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-900">{item.question}</p>
                <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{item.answer}</p>
              </div>
              <button onClick={() => handleToggle(item)} className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-400"}`} title="Toggle visibility">
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
