"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Package,
  Plus,
  ArrowLeft,
  Trash2,
  Loader2,
  Sparkles,
  Search,
  SlidersHorizontal,
  Pencil,
  Save,
  X,
  ImageIcon,
  Video,
  ArrowUp,
  ArrowDown,
  ListPlus,
  AlertTriangle
} from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { MediaUrlField } from "@/components/MediaUrlField";
import { MarkdownDescriptionField } from "@/components/MarkdownDescriptionField";
import { useConfirm } from "@/components/ConfirmDialog";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/pricing";
import { CURRENCY, formatMoney } from "@/lib/currency";

export default function AdminProductsPage() {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  // Live free-shipping threshold (admin-editable in /admin/settings). Used only
  // to warn that a per-product delivery fee is pointless once a product's price
  // reaches the threshold, since any cart containing it then ships free.
  const [freeShipThreshold, setFreeShipThreshold] = useState(FREE_SHIPPING_THRESHOLD);

  // Form Fields
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  // Per-product delivery fee, summed per order and waived above the free-shipping
  // threshold. Blank = free shipping for this product.
  const [shippingFee, setShippingFee] = useState("");
  const [offerLabel, setOfferLabel] = useState("");
  // Pack size the shopper reads ("250 g", "60 capsules") — product identity, not
  // inventory. `stock` below stays a count of whole sellable packs.
  const [netQuantity, setNetQuantity] = useState("");
  // Comma-separated headline ingredients, shown as their own section on the
  // product page and folded into search. See Product.keyIngredients.
  const [keyIngredients, setKeyIngredients] = useState("");
  const [stock, setStock] = useState("");
  // Ordered gallery of media rows: { url, altText, mediaType: "IMAGE" | "VIDEO" }.
  // Row order is the display order on the product page.
  const [media, setMedia] = useState([]);
  // Spec table rows: { label, value }.
  const [attributes, setAttributes] = useState([]);
  const [shortDescription, setShortDescription] = useState("");
  const [description, setDescription] = useState("");
  // Extra search terms (synonyms, benefits, use-cases) that power the storefront
  // search but aren't shown on the product page. See Product.searchKeywords.
  const [searchKeywords, setSearchKeywords] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // When set, the left-hand form is editing this product instead of adding one.
  const [editingId, setEditingId] = useState(null);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setSku("");
    setCategoryId("");
    setPrice("");
    setMrp("");
    setShippingFee("");
    setOfferLabel("");
    setNetQuantity("");
    setKeyIngredients("");
    setStock("");
    setMedia([]);
    setAttributes([]);
    setShortDescription("");
    setDescription("");
    setSearchKeywords("");
  };

  const startEditProduct = (prod) => {
    setEditingId(prod.id);
    setName(prod.name || "");
    setSku(prod.sku || "");
    setCategoryId(prod.categoryId || "");
    setPrice(prod.price != null ? String(prod.price) : "");
    setMrp(prod.mrp != null ? String(prod.mrp) : "");
    setShippingFee(
      prod.shippingFee != null && Number(prod.shippingFee) > 0
        ? String(prod.shippingFee)
        : ""
    );
    setOfferLabel(prod.offerLabel || "");
    setNetQuantity(prod.netQuantity || "");
    setKeyIngredients(prod.keyIngredients || "");
    setStock(prod.stock != null ? String(prod.stock) : "");
    setMedia(
      (prod.images || []).map((img) => ({
        // `id` marks a row that already exists in the DB — its remove button
        // deletes it immediately. Rows added in-session have no id.
        id: img.id,
        url: img.url || "",
        altText: img.altText || "",
        mediaType: img.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
      }))
    );
    setAttributes(
      (prod.attributes || []).map((attr) => ({
        label: attr.label || "",
        value: attr.value || "",
      }))
    );
    setShortDescription(prod.shortDescription || "");
    setDescription(prod.description || "");
    setSearchKeywords(prod.searchKeywords || "");
    // Bring the form into view on smaller screens where it sits above the list.
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ── Media row helpers ──────────────────────────────────────────────────────
  const addMedia = (mediaType) =>
    setMedia((rows) => [...rows, { url: "", altText: "", mediaType }]);

  const updateMedia = (index, patch) =>
    setMedia((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeMedia = async (index) => {
    const row = media[index];

    // A row that isn't persisted yet (just added in this session, or no saved
    // product) only needs to leave local state.
    if (!row?.id || !editingId) {
      setMedia((rows) => rows.filter((_, i) => i !== index));
      return;
    }

    const isVideo = row.mediaType === "VIDEO";
    const ok = await confirm({
      title: `Delete ${isVideo ? "video" : "image"}?`,
      description: `This ${isVideo ? "video" : "image"} will be permanently removed from the product and its uploaded file deleted. This cannot be undone.`,
      confirmLabel: "Delete",
    });
    if (!ok) return;

    const toastId = toast.loading(`Deleting ${isVideo ? "video" : "image"}...`);
    try {
      const res = await fetch(
        `/api/admin/products/${editingId}/images/${row.id}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to delete media.");
      }

      setMedia((rows) => rows.filter((_, i) => i !== index));
      toast.success(`${isVideo ? "Video" : "Image"} deleted.`, { id: toastId });
      // Keep the inventory list's media in sync with the DB.
      await fetchProducts();
    } catch (error) {
      toast.error(error.message || "Error deleting media.", { id: toastId });
    }
  };

  const moveMedia = (index, delta) =>
    setMedia((rows) => {
      const next = [...rows];
      const target = index + delta;
      if (target < 0 || target >= next.length) return rows;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  // ── Spec (attribute) row helpers ───────────────────────────────────────────
  const addAttribute = () =>
    setAttributes((rows) => [...rows, { label: "", value: "" }]);

  const updateAttribute = (index, patch) =>
    setAttributes((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  const removeAttribute = (index) =>
    setAttributes((rows) => rows.filter((_, i) => i !== index));

  // 1. Session Guard & Fetch Inventory Data
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

        // Fetch products & categories list
        await Promise.all([fetchProducts(), fetchCategories()]);
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }

    initPage();
  }, []);

  // Pull the live free-shipping threshold so the shipping-fee field can warn
  // when a product's price already clears it (making the fee dead data).
  useEffect(() => {
    let active = true;
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        const n = Number(data?.settings?.free_shipping_threshold);
        if (active && Number.isFinite(n) && n >= 0) setFreeShipThreshold(n);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // True when a delivery fee is set on a product priced at/above the threshold:
  // any cart with it clears the free-shipping bar, so the fee is never charged.
  const shippingFeeIneffective =
    Number(shippingFee) > 0 &&
    Number(price) > 0 &&
    Number(price) >= freeShipThreshold;

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/admin/products");
      const data = await res.json();
      setProducts(data.products || []);
    } catch (e) {
      toast.error("Failed to load products.");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/categories");
      const data = await res.json();
      setCategories(data.categories || []);
    } catch (e) {
      toast.error("Failed to load categories dropdown.");
    }
  };

  const handleSubmitProduct = async (e) => {
    e.preventDefault();

    if (!name.trim() || !sku.trim() || !categoryId || !price) {
      toast.error("Please fill in all required fields (Name, SKU, Category, Price).");
      return;
    }

    setSubmitting(true);
    const toastId = toast.loading(
      editingId ? "Saving product changes..." : "Adding product to inventory..."
    );

    try {
      // Build the media gallery payload (images + videos in display order).
      // On edit, sending the array replaces the product's media; an empty array
      // clears it (the API replaces media whenever an array is given).
      const imagesArray = media
        .filter((row) => row.url.trim())
        .map((row, index) => ({
          url: row.url.trim(),
          altText: row.altText.trim() || `${name.trim()} ${row.mediaType === "VIDEO" ? "Video" : "Image"}`,
          mediaType: row.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
          sortOrder: index,
        }));

      // Build the specifications payload, keeping only fully-filled rows.
      const attributesArray = attributes
        .filter((row) => row.label.trim() && row.value.trim())
        .map((row, index) => ({
          label: row.label.trim(),
          value: row.value.trim(),
          sortOrder: index,
        }));

      const payload = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        categoryId,
        price: Number(price),
        mrp: mrp ? Number(mrp) : undefined,
        shippingFee: shippingFee ? Number(shippingFee) : 0,
        offerLabel: editingId ? offerLabel.trim() : offerLabel.trim() || undefined,
        netQuantity: editingId ? netQuantity.trim() : netQuantity.trim() || undefined,
        keyIngredients: editingId ? keyIngredients.trim() : keyIngredients.trim() || undefined,
        stock: stock ? Number(stock) : 0,
        shortDescription: editingId ? shortDescription.trim() : shortDescription.trim() || undefined,
        description: editingId ? description.trim() : description.trim() || undefined,
        searchKeywords: editingId ? searchKeywords.trim() : searchKeywords.trim() || undefined,
        images: imagesArray,
        attributes: attributesArray,
      };

      const res = await fetch(
        editingId ? `/api/admin/products/${editingId}` : "/api/admin/products",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to save product.");
      }

      toast.success(
        editingId ? "Product updated successfully!" : "Product created successfully!",
        { id: toastId }
      );
      resetForm();

      // Refresh list
      await fetchProducts();
    } catch (error) {
      toast.error(error.message || "Error saving product.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id, prodName) => {
    const ok = await confirm({
      title: "Disable product?",
      description: `Product "${prodName}" will be disabled and hidden from the store. You can re-enable it later.`,
      confirmLabel: "Disable product",
    });
    if (!ok) {
      return;
    }

    const toastId = toast.loading(`Disabling product ${prodName}...`);

    try {
      const res = await fetch(`/api/admin/products/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to disable product.");
      }

      toast.success(`Product "${prodName}" disabled successfully.`, { id: toastId });
      await fetchProducts();
    } catch (error) {
      toast.error(error.message || "Error disabling product.", { id: toastId });
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
              Inventory Management
            </h1>
          </PageReveal>
        </div>
      </section>

      {/* Main Grid Content */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full">
        <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
          
          {/* Left panel: Form to add / edit a Product */}
          <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm h-fit">
            <h2 className="text-base font-bold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
              {editingId ? (
                <Pencil className="size-5 text-emerald-700" />
              ) : (
                <Plus className="size-5 text-emerald-700" />
              )}
              {editingId ? "Edit Product" : "Add Product"}
            </h2>

            <form onSubmit={handleSubmitProduct} className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800 sm:col-span-2">
                  Product Name *
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={submitting}
                    required
                    placeholder="e.g. Herbal Oil"
                    className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                  />
                </label>

                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                  Product SKU *
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    disabled={submitting}
                    required
                    placeholder="e.g. AHO002"
                    className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700 uppercase"
                  />
                </label>

                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                  Category *
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    disabled={submitting}
                    required
                    className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                  >
                    <option value="">Select...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                  Price ({CURRENCY}) *
                  <input
                    type="number"
                    step="0.01"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    disabled={submitting}
                    required
                    placeholder="49"
                    className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                  />
                </label>

                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                  MRP ({CURRENCY})
                  <input
                    type="number"
                    step="0.01"
                    value={mrp}
                    onChange={(e) => setMrp(e.target.value)}
                    disabled={submitting}
                    placeholder="69"
                    className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                  />
                </label>

                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                  Shipping Fee ({CURRENCY})
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={shippingFee}
                    onChange={(e) => setShippingFee(e.target.value)}
                    disabled={submitting}
                    placeholder="0 = free"
                    className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                  />
                  <span className="text-[10px] font-normal text-slate-500">
                    Per-product delivery charge. Summed per order and waived once the
                    cart passes the free-shipping threshold.
                  </span>
                  {shippingFeeIneffective ? (
                    <span className="flex items-start gap-1.5 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-normal leading-snug text-amber-800">
                      <AlertTriangle className="mt-px size-3 shrink-0" />
                      <span>
                        This price ({formatMoney(price)}) is at or
                        above the free-shipping threshold ({formatMoney(freeShipThreshold)}), so any order
                        with this product ships free and this delivery fee will
                        never be charged. Set it to 0, or lower the price.
                      </span>
                    </span>
                  ) : null}
                </label>

                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800 sm:col-span-2">
                  Offer Badge
                  <input
                    type="text"
                    value={offerLabel}
                    onChange={(e) => setOfferLabel(e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. Up to 4% off"
                    className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                  />
                  <span className="text-[10px] font-normal text-slate-500">
                    Shown as a badge on the product card. Leave blank to hide it.
                  </span>
                </label>

                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                  Stock Qty
                  <input
                    type="number"
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                    disabled={submitting}
                    placeholder="100"
                    className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                  />
                  <span className="text-[10px] font-normal text-slate-500">
                    How many packs are on the shelf — never grams. Pack size goes
                    in Net Quantity.
                  </span>
                </label>

                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800">
                  Net Quantity
                  <input
                    type="text"
                    value={netQuantity}
                    onChange={(e) => setNetQuantity(e.target.value)}
                    disabled={submitting}
                    placeholder="e.g. 250 g / 60 capsules / 100 ml"
                    className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                  />
                  <span className="text-[10px] font-normal text-slate-500">
                    Shown on the card, cart line & product page. Sell two sizes as
                    two products, each with its own SKU and stock.
                  </span>
                </label>

                {/* Media gallery builder — ordered list of images & videos.
                    Order here is the swipe order on the product page. */}
                <div className="grid gap-3 min-w-0 sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Product Media ({media.length})
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => addMedia("IMAGE")}
                        disabled={submitting}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <ImageIcon className="size-3" /> Add image
                      </button>
                      <button
                        type="button"
                        onClick={() => addMedia("VIDEO")}
                        disabled={submitting}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Video className="size-3" /> Add video
                      </button>
                    </div>
                  </div>

                  {media.length === 0 ? (
                    <p className="rounded border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] font-normal text-slate-500">
                      No media yet. Add images and videos — buyers swipe through them in this order.
                    </p>
                  ) : (
                    <div className="grid gap-3">
                      {media.map((row, index) => (
                        <div
                          key={index}
                          className="rounded-md border border-slate-200 bg-slate-50/60 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              {row.mediaType === "VIDEO" ? (
                                <Video className="size-3.5 text-emerald-700" />
                              ) : (
                                <ImageIcon className="size-3.5 text-emerald-700" />
                              )}
                              {row.mediaType === "VIDEO" ? "Video" : "Image"} #{index + 1}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => moveMedia(index, -1)}
                                disabled={submitting || index === 0}
                                title="Move up"
                                className="text-slate-500 hover:text-slate-700 disabled:opacity-30"
                              >
                                <ArrowUp className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => moveMedia(index, 1)}
                                disabled={submitting || index === media.length - 1}
                                title="Move down"
                                className="text-slate-500 hover:text-slate-700 disabled:opacity-30"
                              >
                                <ArrowDown className="size-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => removeMedia(index)}
                                disabled={submitting}
                                title="Remove"
                                className="text-slate-500 hover:text-rose-600 disabled:opacity-30"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </div>
                          <MediaUrlField
                            placeholder={row.mediaType === "VIDEO" ? "https://... .mp4 or upload" : "https://... or upload an image"}
                            value={row.url}
                            onChange={(url) => updateMedia(index, { url })}
                            disabled={submitting}
                            mediaType={row.mediaType}
                          />
                          <input
                            type="text"
                            value={row.altText}
                            onChange={(e) => updateMedia(index, { altText: e.target.value })}
                            disabled={submitting}
                            placeholder="Alt text / caption (optional)"
                            className="mt-2 w-full min-w-0 min-h-9 rounded border border-input bg-white px-3 text-xs font-normal text-slate-700 outline-none transition focus:border-emerald-700"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Specifications builder — key/value rows rendered as a spec
                    table on the product page (like Amazon's product details). */}
                <div className="grid gap-3 min-w-0 sm:col-span-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800">
                      Specifications ({attributes.length})
                    </span>
                    <button
                      type="button"
                      onClick={addAttribute}
                      disabled={submitting}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <ListPlus className="size-3" /> Add spec
                    </button>
                  </div>

                  {attributes.length === 0 ? (
                    <p className="rounded border border-dashed border-slate-200 px-3 py-4 text-center text-[11px] font-normal text-slate-500">
                      No specs yet. Add rows like &quot;Item Form → Powder&quot;, &quot;Shelf Life → 24 months&quot;.
                    </p>
                  ) : (
                    <div className="grid gap-2">
                      {attributes.map((row, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <input
                            type="text"
                            value={row.label}
                            onChange={(e) => updateAttribute(index, { label: e.target.value })}
                            disabled={submitting}
                            placeholder="Label (e.g. Net Weight)"
                            className="w-2/5 min-w-0 min-h-9 rounded border border-input bg-white px-3 text-xs font-normal text-slate-700 outline-none transition focus:border-emerald-700"
                          />
                          <input
                            type="text"
                            value={row.value}
                            onChange={(e) => updateAttribute(index, { value: e.target.value })}
                            disabled={submitting}
                            placeholder="Value (e.g. 200 g)"
                            className="flex-1 min-w-0 min-h-9 rounded border border-input bg-white px-3 text-xs font-normal text-slate-700 outline-none transition focus:border-emerald-700"
                          />
                          <button
                            type="button"
                            onClick={() => removeAttribute(index)}
                            disabled={submitting}
                            title="Remove"
                            className="mt-1 shrink-0 text-slate-500 hover:text-rose-600 disabled:opacity-30"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Key ingredients — a dedicated field rather than a spec row:
                    it renders as its own section on the product page, feeds
                    search, and is a disclosure requirement for supplements. */}
                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800 sm:col-span-2">
                  Key Ingredients
                  <textarea
                    rows={2}
                    value={keyIngredients}
                    onChange={(e) => setKeyIngredients(e.target.value)}
                    disabled={submitting}
                    placeholder="Ashwagandha Root, Shatavari, Brahmi, Cow Ghee"
                    className="w-full min-w-0 rounded border border-input bg-white p-3 text-xs font-normal outline-none transition focus:border-emerald-700 resize-none text-slate-700"
                  />
                  <span className="text-[11px] font-normal text-slate-500">
                    Separate with commas. Shown as its own section on the product
                    page and searchable, so a shopper looking for one ingredient
                    finds this product even when it isn&apos;t in the name.
                  </span>
                </label>

                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800 sm:col-span-2">
                  Short Description
                  <input
                    type="text"
                    value={shortDescription}
                    onChange={(e) => setShortDescription(e.target.value)}
                    disabled={submitting}
                    placeholder="Brief wellness tagline..."
                    className="w-full min-w-0 min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none transition focus:border-emerald-700"
                  />
                </label>

                <MarkdownDescriptionField
                  value={description}
                  onChange={setDescription}
                  disabled={submitting}
                />

                <label className="grid gap-2 min-w-0 text-xs font-semibold text-slate-800 sm:col-span-2">
                  Search Keywords
                  <textarea
                    rows={2}
                    value={searchKeywords}
                    onChange={(e) => setSearchKeywords(e.target.value)}
                    disabled={submitting}
                    placeholder="Benefits, synonyms & use-cases shoppers might type, e.g. libido, stamina, vitality, aphrodisiac, sexual wellness"
                    className="w-full min-w-0 rounded border border-input bg-white p-3 text-xs font-normal outline-none transition focus:border-emerald-700 resize-none text-slate-700"
                  />
                  <span className="text-[11px] font-normal text-slate-500">
                    Hidden from shoppers. Powers search so benefit queries find this
                    product even when these words aren&apos;t in its name. Separate
                    terms with commas.
                  </span>
                </label>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="h-11 flex-1 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="size-3 animate-spin mr-1.5" />
                      {editingId ? "Saving..." : "Adding product..."}
                    </>
                  ) : editingId ? (
                    <>
                      <Save className="size-3.5 mr-1.5" />
                      Save Changes
                    </>
                  ) : (
                    "Create Product"
                  )}
                </Button>
                {editingId ? (
                  <button
                    type="button"
                    onClick={resetForm}
                    disabled={submitting}
                    className="inline-flex h-11 items-center gap-1 rounded-md border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                  >
                    <X className="size-3.5" />
                    Cancel
                  </button>
                ) : null}
              </div>
            </form>
          </FadeIn>

          {/* Right panel: Table of products */}
          <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
            <h2 className="text-base font-bold text-slate-950 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Package className="size-5 text-emerald-705" />
              Store Inventory
            </h2>

            {products.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500 italic text-center py-10">No products found in inventory.</p>
            ) : (
              <>
                {/* Mobile card list — visible below lg (no horizontal scrolling) */}
                <div className="mt-5 flex flex-col gap-3 lg:hidden">
                  {products.map((prod) => (
                    <div
                      key={prod.id}
                      className="rounded-md border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-slate-900 break-words">{prod.name}</p>
                          <p className="mt-0.5 font-mono text-[10px] text-slate-500">{prod.sku}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            onClick={() => startEditProduct(prod)}
                            className="text-slate-500 hover:text-emerald-700 transition"
                            title="Edit Product"
                          >
                            <Pencil className="size-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteProduct(prod.id, prod.name)}
                            disabled={!prod.isActive}
                            className="text-slate-500 hover:text-rose-700 disabled:opacity-30 disabled:hover:text-slate-500 transition"
                            title="Disable Product"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 font-semibold">
                          {prod.category?.name || "Uncategorized"}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold ${
                          prod.isActive
                            ? "bg-emerald-50 text-emerald-800 border border-emerald-250"
                            : "bg-rose-50 text-rose-800 border border-rose-250"
                        }`}>
                          {prod.isActive ? "ACTIVE" : "INACTIVE"}
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3">
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-450">Price / MRP</p>
                          <p className="mt-0.5">
                            <span className="font-extrabold text-emerald-800">{formatMoney(prod.price)}</span>
                            {prod.mrp && (
                              <span className="text-[10px] text-slate-500 line-through ml-1.5">{formatMoney(prod.mrp)}</span>
                            )}
                          </p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-450">Stock Qty</p>
                          <p className={`mt-0.5 font-bold ${prod.stock <= 5 ? "text-rose-700" : "text-slate-900"}`}>
                            {prod.stock} units
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table — visible lg and up */}
                <div className="mt-5 hidden overflow-x-auto lg:block">
                <table className="w-full text-left text-xs font-medium text-slate-650 divide-y divide-slate-100">
                  <thead>
                    <tr className="text-slate-450 uppercase font-bold tracking-wider">
                      <th className="pb-3">Product Info</th>
                      <th className="pb-3">SKU</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Price / MRP</th>
                      <th className="pb-3">Stock Qty</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map((prod) => (
                      <tr key={prod.id} className="hover:bg-slate-50/50">
                        <td className="py-4 font-bold text-slate-900">{prod.name}</td>
                        <td className="py-4 font-mono text-[10px] text-slate-500">{prod.sku}</td>
                        <td className="py-4">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700 font-semibold">
                            {prod.category?.name || "Uncategorized"}
                          </span>
                        </td>
                        <td className="py-4">
                          <span className="font-extrabold text-emerald-800">{formatMoney(prod.price)}</span>
                          {prod.mrp && (
                            <span className="text-[10px] text-slate-500 line-through ml-1.5">{formatMoney(prod.mrp)}</span>
                          )}
                        </td>
                        <td className="py-4">
                          <span className={`font-bold ${prod.stock <= 5 ? "text-rose-700" : "text-slate-900"}`}>
                            {prod.stock} units
                          </span>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold ${
                            prod.isActive 
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-250" 
                              : "bg-rose-50 text-rose-800 border border-rose-250"
                          }`}>
                            {prod.isActive ? "ACTIVE" : "INACTIVE"}
                          </span>
                        </td>
                        <td className="py-4">
                          <div className="flex items-center justify-end gap-3">
                            <button
                              onClick={() => startEditProduct(prod)}
                              className="text-slate-500 hover:text-emerald-700 transition"
                              title="Edit Product"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id, prod.name)}
                              disabled={!prod.isActive}
                              className="text-slate-500 hover:text-rose-700 disabled:opacity-30 disabled:hover:text-slate-500 transition"
                              title="Disable Product"
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
