"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { uploadMedia } from "@/lib/storage/client";
import {
  LayoutTemplate,
  Plus,
  ArrowLeft,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  PackagePlus,
  Upload,
  Film,
  ImageIcon,
  Pencil,
  Save,
  X,
  ExternalLink,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";
import { Modal } from "@/components/Modal";

// Section types — keep value list in sync with HomeSectionType (schema) and the
// HomeSections renderer. `help` explains what the block looks like; `fields`
// lists which item inputs are relevant so the admin only sees what matters.
const SECTION_TYPES = [
  {
    value: "VIDEO_CAROUSEL",
    label: "Video Carousel",
    help: "Full-width background-video cards (e.g. My Face). Each item needs a Video URL.",
    fields: ["videoUrl", "title", "subtitle", "badge", "href", "product"],
  },
  {
    value: "DEAL_GRID",
    label: "Deal Grid (Deals for you)",
    help: "Amazon-style deal cards. Image + top label + product name + discount badge.",
    fields: ["imageUrl", "subtitle", "title", "badge", "href", "product"],
  },
  {
    value: "CATEGORY_GRID",
    label: "Category Grid (Shop by category)",
    help: "Image cards for every active category. The cards are filled automatically from the Categories portal — add or edit categories there, not here.",
    auto: true,
    source: "Categories portal",
    manageHref: "/admin/categories",
    fields: [],
  },
  {
    value: "PRODUCT_CAROUSEL",
    label: "Product Carousel (Featured)",
    help: "Slider of every active product. The cards are filled automatically from the Inventory portal — add or edit products there, not here.",
    auto: true,
    source: "Inventory portal",
    manageHref: "/admin/products",
    fields: [],
  },
  {
    value: "BEST_SELLERS",
    label: "Best Sellers (top selling)",
    help: "Your top products by units actually sold. Filled automatically from paid orders — you can't pick the products. Just set the heading.",
    auto: true,
    source: "real sales",
    autoNote:
      "Ranked automatically by how many units each product has actually sold, counting paid orders only. You can't add, remove or reorder the cards — that's what makes the 'Best Sellers' label true. Until the store has its first paid order this block stays hidden on the site, rather than showing products nobody has bought.",
    fields: [],
  },
  {
    value: "RECENTLY_VIEWED",
    label: "Continue Shopping (recently viewed)",
    help: "Shows each shopper the products they looked at recently, Amazon-style. Personal to every visitor. Just set the heading.",
    auto: true,
    source: "each shopper's history",
    autoNote:
      "Every visitor sees their OWN recently-viewed products here — so this block looks different for each shopper and shows nothing to a first-time visitor. Signed-in shoppers keep their history on their account, so it follows them to any device they sign in on; signed-out visitors keep theirs in their own browser until they sign in. Shoppers can review, delete or switch off their history from Your Account › Browsing History. There is nothing to add or edit; just set the heading above.",
    fields: [],
  },
  {
    value: "PROMO_ADS",
    label: "Promo Banners (Spotlight)",
    help: "Two-up promotional banners. Image + title + description.",
    fields: ["imageUrl", "title", "body", "badge", "href", "product"],
  },
  {
    value: "REVIEWS",
    label: "Reviews",
    help: "Real customer reviews, pulled live from verified buyers. The highest-rated reviews appear automatically — you can't add or edit them. Just set the heading.",
    auto: true,
    source: "customer reviews",
    autoNote:
      "Reviews are written by real verified buyers on product pages — never by an admin. The highest-rated recent reviews appear here automatically, so there is nothing to add or edit. Just set the heading above.",
    fields: [],
  },
  {
    value: "STATS_BAR",
    label: "Stats Bar (scrolling strip)",
    help: "Scrolling strip of live metrics + trust promises. Pick a Metric per item; numbers are computed automatically. Use 'Static text' for fixed promises.",
    fields: ["metric", "title"],
  },
];

// Page-type tabs. Each `placement` is an independent set of sections rendered on
// a different public page. Keep values in sync with SECTION_PLACEMENTS
// (lib/admin-api.js) and the SectionPlacement enum (schema).
const PLACEMENTS = [
  {
    value: "HOME",
    label: "Home",
    help: "Blocks on the public homepage, below the hero.",
  },
  {
    value: "PRODUCT",
    label: "Product pages",
    help: "Shown on every product detail page, in a fixed slot below the product info. The buy-box, description and reviews stay locked.",
  },
  {
    value: "CATEGORY",
    label: "Category pages",
    help: "Shown on every category page, above the product grid.",
  },
  {
    value: "CHECKOUT",
    label: "Checkout",
    help: "A single banner above the locked checkout steps. Only the FIRST active section is used — fill in its Heading and Subtitle (and an optional link via an item).",
  },
];

// Which section types each placement offers. Checkout only needs a simple banner;
// the other pages reuse every homepage block.
const ALL_TYPE_VALUES = SECTION_TYPES.map((t) => t.value);
const PLACEMENT_TYPES = {
  HOME: ALL_TYPE_VALUES,
  PRODUCT: ALL_TYPE_VALUES,
  CATEGORY: ALL_TYPE_VALUES,
  CHECKOUT: ["PROMO_ADS"],
};

function typesForPlacement(placement) {
  const allowed = PLACEMENT_TYPES[placement] || ALL_TYPE_VALUES;
  return SECTION_TYPES.filter((t) => allowed.includes(t.value));
}

// Options for the STATS_BAR metric selector. Live metrics pull real counts; the
// item's Title is used as the label after the number (e.g. "registered customers").
const STATS_METRIC_OPTIONS = [
  { value: "REGISTERED_CUSTOMERS", label: "Live: Registered customers" },
  { value: "PAID_ORDERS", label: "Live: Successful bookings" },
  { value: "STATIC", label: "Static text (no number)" },
];

// Per-field labels + placeholders. The same generic field is reused across
// section types but labelled to fit the context.
const FIELD_META = {
  videoUrl: { label: "Video URL *", type: "url", placeholder: "Upload a video, or paste https://..." },
  imageUrl: { label: "Image URL", type: "url", placeholder: "Upload an image, or paste https://..." },
  title: { label: "Title / Name", type: "text", placeholder: "e.g. Kamakalpa Nabhi Oil" },
  subtitle: { label: "Subtitle / Label", type: "text", placeholder: "e.g. Deals on desires" },
  body: { label: "Description / Quote", type: "textarea", placeholder: "Longer text..." },
  badge: { label: "Badge / Price", type: "text", placeholder: "e.g. Up to 40% off · Rs. 499" },
  href: { label: "Link URL", type: "text", placeholder: "/products or /categories/slug" },
};

function getTypeMeta(type) {
  return SECTION_TYPES.find((t) => t.value === type) || SECTION_TYPES[0];
}

function getPlacementMeta(placement) {
  return PLACEMENTS.find((p) => p.value === placement) || PLACEMENTS[0];
}

export default function AdminHomeBuilderPage() {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);

  const [sections, setSections] = useState([]);
  const [products, setProducts] = useState([]);

  // Active page-type tab. Each placement is an independent set of sections.
  const [placement, setPlacement] = useState("HOME");

  // New-section form
  const [type, setType] = useState("DEAL_GRID");
  const [title, setTitle] = useState("");
  const [eyebrow, setEyebrow] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        await fetchProducts();
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  // Load the sections for the active tab (and whenever the tab changes).
  useEffect(() => {
    if (authChecked) fetchSections();
  }, [authChecked, placement]);

  // Keep the new-section type valid for the active placement (e.g. switching to
  // Checkout, which only allows a banner).
  useEffect(() => {
    const allowed = PLACEMENT_TYPES[placement] || ALL_TYPE_VALUES;
    if (!allowed.includes(type)) setType(allowed[0]);
  }, [placement]);

  async function fetchSections() {
    try {
      const res = await fetch(`/api/admin/home-sections?placement=${placement}`);
      const data = await res.json();
      setSections(data.sections || []);
    } catch {
      toast.error("Failed to load sections.");
    }
  }

  async function fetchProducts() {
    try {
      const res = await fetch("/api/admin/products?status=active");
      const data = await res.json();
      setProducts(data.products || []);
    } catch {
      // Product picker is optional; ignore failures.
    }
  }

  async function handleCreateSection(e) {
    e.preventDefault();
    setSubmitting(true);
    const toastId = toast.loading("Creating section...");
    try {
      const res = await fetch("/api/admin/home-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          placement,
          title: title.trim() || undefined,
          eyebrow: eyebrow.trim() || undefined,
          subtitle: subtitle.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create section.");
      toast.success("Section created.", { id: toastId });
      setTitle("");
      setEyebrow("");
      setSubtitle("");
      await fetchSections();
    } catch (error) {
      toast.error(error.message || "Error creating section.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleSection(section) {
    const toastId = toast.loading("Updating...");
    try {
      const res = await fetch(`/api/admin/home-sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !section.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update section.");
      toast.success(section.isActive ? "Section hidden." : "Section shown.", { id: toastId });
      await fetchSections();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function handleMoveSection(section, direction) {
    const ordered = [...sections];
    const index = ordered.findIndex((s) => s.id === section.id);
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= ordered.length) return;

    // Move the section within the array, then re-number the whole list to
    // sequential positions (0,1,2,…). Swapping just the two stored `position`
    // values does nothing when sections share a value (e.g. legacy rows left at
    // the default 0), so we normalise every section instead and only PATCH the
    // ones whose position actually changes.
    [ordered[index], ordered[swapWith]] = [ordered[swapWith], ordered[index]];

    const updates = ordered
      .map((s, i) => ({ id: s.id, position: i }))
      .filter((u) => sections.find((s) => s.id === u.id)?.position !== u.position);

    if (updates.length === 0) return;

    const toastId = toast.loading("Reordering...");
    try {
      await Promise.all(
        updates.map((u) =>
          fetch(`/api/admin/home-sections/${u.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ position: u.position }),
          })
        )
      );
      toast.success("Reordered.", { id: toastId });
      await fetchSections();
    } catch (error) {
      toast.error("Failed to reorder.", { id: toastId });
    }
  }

  async function handleDeleteSection(section) {
    const ok = await confirm({
      title: "Delete section?",
      description: `This will permanently delete the ${getTypeMeta(section.type).label} section and all of its items. This cannot be undone.`,
      confirmLabel: "Delete section",
    });
    if (!ok) return;
    const toastId = toast.loading("Deleting section...");
    try {
      const res = await fetch(`/api/admin/home-sections/${section.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete section.");
      toast.success("Section deleted.", { id: toastId });
      await fetchSections();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  if (loading || !authChecked) {
    return (
      <main className="min-h-screen overflow-x-hidden bg-slate-50 text-white flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-semibold text-slate-500">Accessing administrative dashboard...</p>
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="bg-slate-900 py-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageReveal>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#565959] hover:text-[#007185] mb-2"
            >
              <ArrowLeft className="size-3" />
              Console Home
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <LayoutTemplate className="size-7 text-emerald-700" />
              Content Builder
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Build the public pages from blocks. Pick a page below; only active sections with items appear on the site.
            </p>

            {/* Page-type tabs — each is an independent set of sections. */}
            <div className="mt-5 flex flex-wrap gap-2">
              {PLACEMENTS.map((p) => {
                const active = p.value === placement;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setPlacement(p.value)}
                    className={`rounded-md px-3.5 py-2 text-xs font-bold transition ${
                      active
                        ? "bg-emerald-700 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full">
        <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
          {/* Add Section form */}
          <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm h-fit">
            <h2 className="text-base font-bold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus className="size-5 text-emerald-700" />
              Add Section
            </h2>
            <p className="mt-3 rounded bg-slate-50 border border-slate-200 px-3 py-2 text-[11px] leading-5 text-slate-600">
              {getPlacementMeta(placement).help}
            </p>
            <form onSubmit={handleCreateSection} className="mt-4 grid gap-4">
              <label className="grid gap-2 text-xs font-semibold text-slate-800">
                Section Type *
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  disabled={submitting}
                  className="w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
                >
                  {typesForPlacement(placement).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="rounded bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] leading-5 text-emerald-900">
                {getTypeMeta(type).help}
              </p>

              <label className="grid gap-2 text-xs font-semibold text-slate-800">
                Heading
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Deals just for you"
                  className="w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
                />
              </label>

              <label className="grid gap-2 text-xs font-semibold text-slate-800">
                Eyebrow (small label above heading)
                <input
                  type="text"
                  value={eyebrow}
                  onChange={(e) => setEyebrow(e.target.value)}
                  disabled={submitting}
                  placeholder="e.g. Today's offers"
                  className="w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
                />
              </label>

              <label className="grid gap-2 text-xs font-semibold text-slate-800">
                Subtitle (description)
                <textarea
                  rows={2}
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  disabled={submitting}
                  placeholder="Short description under the heading..."
                  className="w-full rounded border border-input bg-white p-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700 resize-none"
                />
              </label>

              <Button type="submit" disabled={submitting} className="h-10 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold mt-2">
                {submitting ? (
                  <>
                    <Loader2 className="size-3 animate-spin mr-1.5" />
                    Adding...
                  </>
                ) : (
                  "Create Section"
                )}
              </Button>
            </form>
          </FadeIn>

          {/* Sections list */}
          <div className="grid min-w-0 gap-5">
            {sections.length === 0 ? (
              <FadeIn className="rounded-md border border-dashed border-slate-300 bg-white p-10 text-center">
                <LayoutTemplate className="mx-auto size-8 text-slate-500" />
                <p className="mt-3 text-sm font-semibold text-slate-600">
                  No sections on {getPlacementMeta(placement).label} yet.
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Create a section on the left — it will appear on this page once you add items to it.
                </p>
              </FadeIn>
            ) : (
              sections.map((section, index) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  index={index}
                  total={sections.length}
                  products={products}
                  onChanged={fetchSections}
                  onToggle={() => handleToggleSection(section)}
                  onDelete={() => handleDeleteSection(section)}
                  onMove={(dir) => handleMoveSection(section, dir)}
                />
              ))
            )}
          </div>
        </div>
      </section>

      <SiteFooter />
      {confirmDialog}
    </main>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One section card: header controls + collapsible item manager.
// ─────────────────────────────────────────────────────────────────────────────
function SectionCard({ section, index, total, products, onChanged, onToggle, onDelete, onMove }) {
  const meta = getTypeMeta(section.type);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [detailsForm, setDetailsForm] = useState({
    title: section.title || "",
    eyebrow: section.eyebrow || "",
    subtitle: section.subtitle || "",
  });
  const [savingDetails, setSavingDetails] = useState(false);

  function startEditingDetails() {
    // Reset to the current stored values each time the editor opens.
    setDetailsForm({
      title: section.title || "",
      eyebrow: section.eyebrow || "",
      subtitle: section.subtitle || "",
    });
    setEditing(true);
  }

  async function handleSaveDetails(e) {
    e.preventDefault();
    setSavingDetails(true);
    const toastId = toast.loading("Saving section...");
    try {
      const res = await fetch(`/api/admin/home-sections/${section.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: detailsForm.title.trim(),
          eyebrow: detailsForm.eyebrow.trim(),
          subtitle: detailsForm.subtitle.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save section.");
      toast.success("Section updated.", { id: toastId });
      setEditing(false);
      await onChanged();
    } catch (error) {
      toast.error(error.message || "Error saving section.", { id: toastId });
    } finally {
      setSavingDetails(false);
    }
  }

  return (
    <FadeIn className={`min-w-0 rounded-md border bg-white shadow-sm ${section.isActive ? "border-border" : "border-slate-200 opacity-70"}`}>
      <div className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex flex-col gap-0.5 pt-0.5">
            <button onClick={() => onMove("up")} disabled={index === 0} className="text-slate-500 hover:text-slate-700 disabled:opacity-20" title="Move up">
              <ChevronUp className="size-4" />
            </button>
            <button onClick={() => onMove("down")} disabled={index === total - 1} className="text-slate-500 hover:text-slate-700 disabled:opacity-20" title="Move down">
              <ChevronDown className="size-4" />
            </button>
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                {meta.label}
              </span>
              <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold ${section.isActive ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-500 border border-slate-200"}`}>
                {section.isActive ? "LIVE" : "HIDDEN"}
              </span>
              {meta.auto ? (
                <span className="rounded bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 border border-sky-200">
                  Auto from {meta.source}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">
                  {section.items.length} item{section.items.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <p className="mt-1.5 text-sm font-bold text-slate-900 break-words">
              {section.title || <span className="italic text-slate-500">No heading</span>}
            </p>
            {section.eyebrow ? <p className="text-[11px] text-slate-500">{section.eyebrow}</p> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <button onClick={editing ? () => setEditing(false) : startEditingDetails} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" title="Edit heading, eyebrow & subtitle">
            <Pencil className="size-3.5" />
            {editing ? "Close edit" : "Edit details"}
          </button>
          <button onClick={onToggle} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" title={section.isActive ? "Hide from homepage" : "Show on homepage"}>
            {section.isActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            {section.isActive ? "Hide" : "Show"}
          </button>
          {meta.auto ? (
            meta.manageHref ? (
              <Link href={meta.manageHref} className="inline-flex items-center gap-1 rounded border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-50" title={`Manage cards in the ${meta.source}`}>
                <ExternalLink className="size-3.5" />
                Open {meta.source}
              </Link>
            ) : null
          ) : (
            <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-emerald-800">
              <GripVertical className="size-3.5" />
              {open ? "Close items" : "Manage items"}
            </button>
          )}
          <button onClick={onDelete} className="text-slate-500 hover:text-rose-700" title="Delete section">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="border-t border-slate-100 bg-slate-50/60 p-5">
          <form onSubmit={handleSaveDetails} className="grid gap-3">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
              <Pencil className="size-3.5 text-emerald-700" />
              Edit Section Details
            </h4>
            <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
              Heading
              <input
                type="text"
                value={detailsForm.title}
                onChange={(e) => setDetailsForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Deals just for you"
                className="w-full min-w-0 min-h-9 rounded border border-input bg-white px-2 text-[11px] font-normal text-slate-900 outline-none focus:border-emerald-700"
              />
            </label>
            <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
              Eyebrow (small label above heading)
              <input
                type="text"
                value={detailsForm.eyebrow}
                onChange={(e) => setDetailsForm((f) => ({ ...f, eyebrow: e.target.value }))}
                placeholder="e.g. Today's offers"
                className="w-full min-w-0 min-h-9 rounded border border-input bg-white px-2 text-[11px] font-normal text-slate-900 outline-none focus:border-emerald-700"
              />
            </label>
            <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
              Subtitle (description)
              <textarea
                rows={2}
                value={detailsForm.subtitle}
                onChange={(e) => setDetailsForm((f) => ({ ...f, subtitle: e.target.value }))}
                placeholder="Short description under the heading..."
                className="w-full rounded border border-input bg-white p-2 text-[11px] font-normal text-slate-900 outline-none focus:border-emerald-700 resize-none"
              />
            </label>
            <div className="flex items-center gap-2">
              <Button type="submit" disabled={savingDetails} className="h-9 flex-1 bg-emerald-700 hover:bg-emerald-800 rounded text-[11px] font-semibold">
                {savingDetails ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <>
                    <Save className="size-3.5 mr-1" />
                    Save
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={savingDetails}
                className="inline-flex h-9 items-center gap-1 rounded border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="size-3.5" />
                Cancel
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {meta.auto ? (
        <div className="border-t border-slate-100 bg-sky-50/40 px-5 py-3">
          {meta.autoNote ? (
            <p className="text-[11px] leading-5 text-slate-600">{meta.autoNote}</p>
          ) : (
            <p className="text-[11px] leading-5 text-slate-600">
              Cards are generated automatically from the{" "}
              <Link href={meta.manageHref} className="font-semibold text-sky-700 underline-offset-2 hover:underline">
                {meta.source}
              </Link>
              . Every active{" "}
              {section.type === "CATEGORY_GRID" ? "category" : "product"} appears here — there is nothing to add or edit on this card.
            </p>
          )}
        </div>
      ) : open ? (
        <div className="border-t border-slate-100 bg-slate-50/60 p-5">
          <ItemManager section={section} meta={meta} products={products} onChanged={onChanged} />
        </div>
      ) : null}
    </FadeIn>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Item manager: list existing items + an add-item form with only the fields
// relevant to this section type.
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_ITEM = {
  title: "",
  subtitle: "",
  body: "",
  imageUrl: "",
  videoUrl: "",
  badge: "",
  href: "",
  metric: "REGISTERED_CUSTOMERS",
  productId: "",
};

// Map a stored item to the flat form shape the editor inputs expect.
function itemToForm(item) {
  return {
    title: item.title || "",
    subtitle: item.subtitle || "",
    body: item.body || "",
    imageUrl: item.imageUrl || "",
    videoUrl: item.videoUrl || "",
    badge: item.badge || "",
    href: item.href || "",
    metric: item.metric || "REGISTERED_CUSTOMERS",
    productId: item.productId || "",
  };
}

// Build the request body from a form, including only fields relevant to this
// section type. When `includeEmpty` is true (editing), cleared fields are sent
// as "" so the server can null them out; for adding we omit empties entirely.
function buildItemPayload(form, meta, { includeEmpty = false } = {}) {
  const showProduct = meta.fields.includes("product");
  const showMetric = meta.fields.includes("metric");
  const textFields = meta.fields.filter((f) => f !== "product" && f !== "metric");

  const payload = {};
  for (const key of textFields) {
    const value = (form[key] || "").trim();
    if (includeEmpty || value) payload[key] = value;
  }
  if (showProduct && (includeEmpty || form.productId)) {
    payload.productId = form.productId || "";
  }
  if (showMetric && form.metric) payload.metric = form.metric;
  return payload;
}

function ItemManager({ section, meta, products, onChanged }) {
  const [form, setForm] = useState(EMPTY_ITEM);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function openAdd() {
    setForm(EMPTY_ITEM); // start each new item from a clean slate
    setAdding(true);
  }

  function closeAdd() {
    if (saving) return; // don't drop a request mid-flight
    setAdding(false);
  }

  async function handleAddItem(e) {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading("Adding item...");
    try {
      const payload = buildItemPayload(form, meta);

      const res = await fetch(`/api/admin/home-sections/${section.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to add item.");
      toast.success("Item added.", { id: toastId });
      setForm(EMPTY_ITEM);
      setAdding(false);
      await onChanged();
    } catch (error) {
      toast.error(error.message || "Error adding item.", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Items</h4>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex shrink-0 items-center gap-1.5 rounded bg-emerald-700 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-emerald-800"
        >
          <PackagePlus className="size-4" />
          Add Item
        </button>
      </div>

      {/* Existing items */}
      {section.items.length === 0 ? (
        <p className="text-xs italic text-slate-500">No items yet. Click &quot;Add Item&quot; to create one.</p>
      ) : (
        <ul className="grid min-w-0 gap-2">
          {section.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              meta={meta}
              products={products}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}

      {/* Add item form (modal) */}
      {adding ? (
        <Modal title={`Add ${meta.label} item`} onClose={closeAdd}>
          <form onSubmit={handleAddItem} className="grid min-w-0 gap-3">
            <ItemFields meta={meta} products={products} form={form} update={update} />

            <div className="mt-1 flex items-center gap-2">
              <Button type="submit" disabled={saving} className="h-9 flex-1 rounded bg-emerald-700 text-[11px] font-semibold hover:bg-emerald-800">
                {saving ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <>
                    <PackagePlus className="mr-1 size-3.5" />
                    Add Item
                  </>
                )}
              </Button>
              <button
                type="button"
                onClick={closeAdd}
                disabled={saving}
                className="inline-flex h-9 items-center gap-1 rounded border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <X className="size-3.5" />
                Cancel
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// The relevant input fields for a section type, shared by the add form and the
// per-item editor. `form`/`update` are owned by the parent so the same markup
// drives either flow.
// ─────────────────────────────────────────────────────────────────────────────
function ItemFields({ meta, products, form, update }) {
  const showProduct = meta.fields.includes("product");
  const showMetric = meta.fields.includes("metric");
  const textFields = meta.fields.filter((f) => f !== "product" && f !== "metric");

  return (
    <>
      {showMetric ? (
        <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
          Metric *
          <select
            value={form.metric}
            onChange={(e) => update("metric", e.target.value)}
            className="w-full min-h-9 rounded border border-input bg-white px-2 text-[11px] text-slate-900 outline-none focus:border-emerald-700"
          >
            {STATS_METRIC_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <span className="text-[10px] font-normal text-slate-500">
            For live metrics, Title is the label after the number (e.g. &quot;registered customers&quot;). For static text, Title is the full text.
          </span>
        </label>
      ) : null}

      {showProduct ? (
        <label className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
          Link Product (optional)
          <select
            value={form.productId}
            onChange={(e) => update("productId", e.target.value)}
            className="w-full min-h-9 rounded border border-input bg-white px-2 text-[11px] text-slate-900 outline-none focus:border-emerald-700"
          >
            <option value="">— None —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {textFields.map((key) => {
        const fm = FIELD_META[key];
        if (!fm) return null;
        // Video URL gets an extra "upload from computer" path alongside the
        // plain URL box, so the admin can either paste a link or pick a file.
        if (key === "videoUrl") {
          return (
            <VideoUrlField
              key={key}
              label={fm.label}
              placeholder={fm.placeholder}
              value={form.videoUrl}
              onChange={(v) => update("videoUrl", v)}
            />
          );
        }
        // Image URL fields (deals, promo banners, categories, featured) get the
        // same paste-a-link-or-upload-a-file treatment as video.
        if (key === "imageUrl") {
          return (
            <ImageUrlField
              key={key}
              label={fm.label}
              placeholder={fm.placeholder}
              value={form.imageUrl}
              onChange={(v) => update("imageUrl", v)}
            />
          );
        }
        return (
          <label key={key} className="grid gap-1.5 text-[11px] font-semibold text-slate-700">
            {fm.label}
            {fm.type === "textarea" ? (
              <textarea
                rows={2}
                value={form[key]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={fm.placeholder}
                className="w-full rounded border border-input bg-white p-2 text-[11px] font-normal text-slate-900 outline-none focus:border-emerald-700 resize-none"
              />
            ) : (
              <input
                type="text"
                value={form[key]}
                onChange={(e) => update(key, e.target.value)}
                placeholder={fm.placeholder}
                className="w-full min-w-0 min-h-9 rounded border border-input bg-white px-2 text-[11px] font-normal text-slate-900 outline-none focus:border-emerald-700"
              />
            )}
          </label>
        );
      })}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// One item in the list. Collapsed it shows a summary + toggle/edit/delete; the
// edit button expands an inline form (same fields as Add) to update it in place.
// ─────────────────────────────────────────────────────────────────────────────
function ItemRow({ item, meta, products, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => itemToForm(item));
  const [saving, setSaving] = useState(false);

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function startEditing() {
    setForm(itemToForm(item)); // reset to current values each time we open
    setEditing(true);
  }

  async function handleToggle() {
    try {
      await fetch(`/api/admin/home-section-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !item.isActive }),
      });
      await onChanged();
    } catch {
      toast.error("Failed to update item.");
    }
  }

  async function handleDelete() {
    const toastId = toast.loading("Removing item...");
    try {
      const res = await fetch(`/api/admin/home-section-items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to remove item.");
      toast.success("Item removed.", { id: toastId });
      await onChanged();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading("Saving changes...");
    try {
      const payload = buildItemPayload(form, meta, { includeEmpty: true });
      const res = await fetch(`/api/admin/home-section-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save item.");
      toast.success("Item updated.", { id: toastId });
      setEditing(false);
      await onChanged();
    } catch (error) {
      toast.error(error.message || "Error saving item.", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <li className="min-w-0 rounded border border-emerald-200 bg-white p-3">
        <form onSubmit={handleSave} className="grid min-w-0 gap-3">
          <h5 className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900">
            <Pencil className="size-3.5 text-emerald-700" />
            Edit Item
          </h5>

          <ItemFields meta={meta} products={products} form={form} update={update} />

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving} className="h-9 flex-1 bg-emerald-700 hover:bg-emerald-800 rounded text-[11px] font-semibold">
              {saving ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <>
                  <Save className="size-3.5 mr-1" />
                  Save
                </>
              )}
            </Button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1 rounded border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <X className="size-3.5" />
              Cancel
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 rounded border border-slate-200 bg-white p-2.5">
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="size-10 shrink-0 rounded object-cover" />
      ) : item.videoUrl ? (
        <span className="flex size-10 shrink-0 items-center justify-center rounded bg-emerald-700 text-[9px] font-bold text-white">VIDEO</span>
      ) : (
        <span className="size-10 shrink-0 rounded bg-slate-100" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-bold text-slate-900">
          {item.title || item.product?.name || item.badge || item.subtitle || "(untitled item)"}
        </p>
        <p className="truncate text-[10px] text-slate-500">
          {item.product ? `→ ${item.product.name}` : item.href || item.videoUrl || item.subtitle || ""}
        </p>
      </div>
      <button onClick={handleToggle} className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${item.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`} title="Toggle visibility">
        {item.isActive ? "ON" : "OFF"}
      </button>
      <button onClick={startEditing} className="shrink-0 text-slate-500 hover:text-emerald-700" title="Edit item">
        <Pencil className="size-3.5" />
      </button>
      <button onClick={handleDelete} className="shrink-0 text-slate-500 hover:text-rose-700" title="Remove item">
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Video URL input with a "choose a file" alternative. Pasting a URL still works;
// picking a local file uploads it to /api/admin/upload and drops the returned
// public URL straight into the same field.
// ─────────────────────────────────────────────────────────────────────────────
function VideoUrlField({ label, placeholder, value, onChange }) {
  const inputId = useId();
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file later
    if (!file) return;

    // `accept` is only a hint — the picker still allows "All files". Catch an
    // unplayable container here, before any bytes are uploaded.
    if (file.type === "video/quicktime" || /\.mov$/i.test(file.name)) {
      toast.error(
        "QuickTime (.mov) videos don't play in Chrome or Firefox. Convert to MP4 first — scripts/compress-videos.mjs does this and shrinks the file too.",
        { duration: 8000 }
      );
      return;
    }

    setUploading(true);
    const toastId = toast.loading("Uploading video...");
    try {
      // Uploads straight to object storage from the browser; /api/admin/upload
      // only issues the (admin-gated) target, so large videos never pass through
      // a route handler.
      onChange(await uploadMedia(file));
      toast.success("Video uploaded.", { id: toastId });
    } catch (error) {
      toast.error(error.message || "Upload failed.", { id: toastId });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="grid gap-1.5 min-w-0 text-[11px] font-semibold text-slate-700">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 min-h-9 rounded border border-input bg-white px-2 text-[11px] font-normal text-slate-900 outline-none focus:border-emerald-700"
      />
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-normal text-slate-400">or</span>
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 ${uploading ? "pointer-events-none opacity-60" : ""}`}
        >
          {uploading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Upload className="size-3.5" />
          )}
          {uploading ? "Uploading..." : "Upload from computer"}
          <input
            type="file"
            // No .mov — it only plays in Safari. See /api/admin/upload.
            accept="video/mp4,video/webm,video/ogg"
            onChange={handleFile}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>
      {value && !uploading ? (
        <span className="flex min-w-0 max-w-full items-center gap-1 text-[10px] font-normal text-emerald-700">
          <Film className="size-3 shrink-0" />
          <span className="truncate">{value}</span>
        </span>
      ) : null}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Image URL input with a "choose a file" alternative. Mirrors VideoUrlField:
// pasting a URL still works; picking a local image uploads it to
// /api/admin/upload and drops the returned public URL into the same field. Used
// by deal cards, promo banners, category cards, and featured products.
// ─────────────────────────────────────────────────────────────────────────────
const IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml";

function ImageUrlField({ label, placeholder, value, onChange }) {
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

  return (
    <div className="grid gap-1.5 min-w-0 text-[11px] font-semibold text-slate-700">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-w-0 min-h-9 rounded border border-input bg-white px-2 text-[11px] font-normal text-slate-900 outline-none focus:border-emerald-700"
      />
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-normal text-slate-400">or</span>
        <label
          className={`inline-flex cursor-pointer items-center gap-1.5 rounded border border-slate-200 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 transition hover:bg-slate-50 ${uploading ? "pointer-events-none opacity-60" : ""}`}
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
            disabled={uploading}
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
