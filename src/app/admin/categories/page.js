"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FolderTree,
  Plus,
  ArrowLeft,
  Trash2,
  Eye,
  Loader2,
  ShieldCheck,
  Check,
  Sparkles,
  Pencil,
  Save,
  X
} from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { ImageUrlField } from "@/components/ImageUrlField";
import { useConfirm } from "@/components/ConfirmDialog";

export default function AdminCategoriesPage() {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form Fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [parentId, setParentId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // When set, the left-hand form is editing this category instead of adding a new one.
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setImageUrl("");
    setParentId("");
  };

  const startEditCategory = (cat) => {
    setEditingId(cat.id);
    setName(cat.name || "");
    setDescription(cat.description || "");
    setImageUrl(cat.imageUrl || "");
    setParentId(cat.parentId || "");
    // Bring the form into view on smaller screens where it sits above the list.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // 1. Session Guard & Fetch Categories
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
        setSession(sessionData.session);
        setAuthChecked(true);

        // Fetch categories list
        await fetchCategories();
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }

    initPage();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (e) {
      toast.error("Failed to load categories.");
    }
  };

  const handleSubmitCategory = async (e) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Category name is required.");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(
      editingId ? "Saving category changes..." : "Adding category to database..."
    );

    try {
      // Editing sends every field (including cleared ones) so the server can
      // null them out; adding omits empties. parentId is always sent so it can
      // be cleared back to a root category.
      const payload = editingId
        ? {
            name: name.trim(),
            description: description.trim(),
            imageUrl: imageUrl.trim(),
            parentId: parentId || "",
          }
        : {
            name: name.trim(),
            description: description.trim() || undefined,
            imageUrl: imageUrl.trim() || undefined,
            parentId: parentId || undefined,
          };

      const res = await fetch(
        editingId ? `/api/admin/categories/${editingId}` : "/api/admin/categories",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to save category.");
      }

      toast.success(
        editingId ? "Category updated successfully!" : "Category created successfully!",
        { id: toastId }
      );
      resetForm();

      // Refresh list
      await fetchCategories();
    } catch (error) {
      toast.error(error.message || "Error saving category.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategory = async (cat) => {
    const catName = cat.name;
    const productCount = cat._count?.products || 0;
    const subCount = cat.subcategories?.length || 0;

    // Spell out exactly what happens to what's inside it — nothing is deleted
    // along with the category, so the admin should not have to guess.
    const consequences = [
      productCount
        ? `${productCount} product${productCount === 1 ? "" : "s"} will stay in the store, just uncategorized.`
        : null,
      subCount
        ? `${subCount} subcategor${subCount === 1 ? "y" : "ies"} will become top-level categor${subCount === 1 ? "y" : "ies"}.`
        : null,
    ].filter(Boolean);

    const ok = await confirm({
      title: "Delete category?",
      description: [
        `Category "${catName}" will be permanently deleted.`,
        ...consequences,
        "This cannot be undone.",
      ].join(" "),
      confirmLabel: "Delete category",
    });
    if (!ok) {
      return;
    }

    const toastId = toast.loading(`Deleting category ${catName}...`);

    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to delete category.");
      }

      toast.success(data.message || `Category "${catName}" deleted.`, { id: toastId });

      // The form may have been editing (or parented to) the category that just
      // went away — reset so it can't submit a dangling id.
      if (editingId === cat.id || parentId === cat.id) {
        resetForm();
      }

      await fetchCategories();
    } catch (error) {
      toast.error(error.message || "Error deleting category.", { id: toastId });
    }
  };

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

      {/* Header Banner */}
      <section className="bg-slate-950 py-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageReveal>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white mb-2"
            >
              <ArrowLeft className="size-3" />
              Console Home
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Category Management
            </h1>
          </PageReveal>
        </div>
      </section>

      {/* Main Grid Content */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full">
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          
          {/* Left panel: Form to add / edit a Category */}
          <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm h-fit">
            <h2 className="text-base font-bold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
              {editingId ? (
                <Pencil className="size-5 text-emerald-700" />
              ) : (
                <Plus className="size-5 text-emerald-700" />
              )}
              {editingId ? "Edit Category" : "Add Category"}
            </h2>

            <form onSubmit={handleSubmitCategory} className="mt-5 grid gap-4">
              <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                Category Name *
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  required
                  placeholder="e.g. Daily Wellness"
                  className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                />
              </label>

              <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                Description
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={submitting}
                  placeholder="Provide short details..."
                  className="w-full min-w-0 rounded border border-input bg-white p-3 text-xs font-normal outline-none transition focus:border-emerald-700 resize-none"
                />
              </label>

              <ImageUrlField
                label="Image URL"
                placeholder="https://... or upload a file"
                value={imageUrl}
                onChange={setImageUrl}
                disabled={submitting}
              />

              <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                Parent Category (Optional)
                <select
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  disabled={submitting}
                  className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                >
                  <option value="">No Parent (Root Category)</option>
                  {categories
                    .filter((cat) => !cat.parentId && cat.id !== editingId)
                    .map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                </select>
              </label>

              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-10 flex-1 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-3 animate-spin mr-1.5" />
                      {editingId ? "Saving..." : "Adding..."}
                    </>
                  ) : editingId ? (
                    <>
                      <Save className="size-3.5 mr-1.5" />
                      Save Changes
                    </>
                  ) : (
                    "Create Category"
                  )}
                </Button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={submitting}
                    className="inline-flex h-10 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </FadeIn>

          {/* Right panel: Table of categories */}
          <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-950 border-b border-slate-100 pb-3 flex items-center gap-2">
              <FolderTree className="size-5 text-emerald-750" />
              Existing Collections
            </h2>

            {categories.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500 italic text-center py-10">No categories found in database.</p>
            ) : (
              <>
                {/* Mobile card list — visible below lg (no horizontal scrolling) */}
                <div className="mt-5 flex flex-col gap-3 lg:hidden">
                  {categories.map((cat) => (
                    <div
                      key={cat.id}
                      className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 break-words">{cat.name}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500">{cat.slug}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => startEditCategory(cat)}
                            className="text-slate-500 hover:text-emerald-700 transition"
                            title="Edit Category"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(cat)}
                            className="text-slate-500 hover:text-rose-700 transition"
                            title="Delete Category"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {cat.parent ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                            {cat.parent.name}
                          </span>
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">None (Root)</span>
                        )}
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold ${
                          cat.isActive
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-250"
                            : "bg-rose-50 text-rose-800 border border-rose-250"
                        }`}>
                          {cat.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>

                      <div className="mt-3 border-t border-slate-100 pt-3">
                        <p className="text-[9px] font-bold uppercase tracking-wider text-slate-450">Products Count</p>
                        <p className="mt-0.5 font-extrabold text-slate-900">{cat._count?.products || 0}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table — visible lg and up */}
                <div className="mt-5 hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-xs font-medium text-slate-650 divide-y divide-slate-100">
                  <thead>
                    <tr className="text-slate-450 uppercase font-bold tracking-wider">
                      <th className="pb-3">Category Name</th>
                      <th className="pb-3">Slug</th>
                      <th className="pb-3">Parent Collection</th>
                      <th className="pb-3">Products Count</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categories.map((cat) => (
                      <tr key={cat.id} className="hover:bg-slate-50/50">
                        <td className="py-4 font-bold text-slate-900">{cat.name}</td>
                        <td className="py-4 font-mono text-[10px] text-slate-500">{cat.slug}</td>
                        <td className="py-4">
                          {cat.parent ? (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700">
                              {cat.parent.name}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">None (Root)</span>
                          )}
                        </td>
                        <td className="py-4 font-extrabold text-slate-900">
                          {cat._count?.products || 0}
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold ${
                            cat.isActive 
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-250" 
                              : "bg-rose-50 text-rose-800 border border-rose-250"
                          }`}>
                            {cat.isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => startEditCategory(cat)}
                              className="text-slate-500 hover:text-emerald-700 transition"
                              title="Edit Category"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat)}
                              className="text-slate-500 hover:text-rose-700 transition"
                              title="Delete Category"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </>
            )}
          </FadeIn>

        </div>
      </section>

      <SiteFooter />
      {confirmDialog}
    </main>
  );
}
