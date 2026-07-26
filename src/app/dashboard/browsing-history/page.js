"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { History, Loader2, Trash2, X } from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { ProductMedia } from "@/components/ProductMedia";
import { useConfirm } from "@/components/ConfirmDialog";
import { clearRecentlyViewed } from "@/lib/recently-viewed";

// Amazon's "Browsing History" page: everything we hold about what this shopper
// has looked at, with the controls to remove it or stop recording.
//
// The page is deliberately blunt about what is stored and where — a shopper who
// can see their history should also be able to understand and undo it.

// "2 hours ago" / "3 days ago" — the granularity Amazon shows. Anything past a
// week falls back to a plain date, where the exact day matters more than the gap.
function timeAgo(iso) {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days <= 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(then).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BrowsingHistoryPage() {
  const [confirm, confirmDialog] = useConfirm();
  const [items, setItems] = useState([]);
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/user/browsing-history")
      .then((r) => (r.ok ? r.json() : { items: [], enabled: true }))
      .then((data) => {
        setItems(Array.isArray(data.items) ? data.items : []);
        setEnabled(data.enabled !== false);
      })
      .catch(() => toast.error("Couldn't load your browsing history."))
      .finally(() => setLoading(false));
  }, []);

  async function handleToggle() {
    const next = !enabled;
    setBusy(true);
    // Optimistic: the switch should feel instant, and it's reverted below if the
    // request fails.
    setEnabled(next);
    try {
      const res = await fetch("/api/user/browsing-history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // Turning it off must also drop anything this browser is still holding
      // from before the shopper signed in, or the strip would keep showing it.
      if (!next) clearRecentlyViewed();

      toast.success(data.message);
    } catch (e) {
      setEnabled(!next);
      toast.error(e.message || "Couldn't change that setting.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(productId, name) {
    const previous = items;
    setItems((list) => list.filter((item) => item.product.id !== productId));
    try {
      const res = await fetch(
        `/api/user/browsing-history?productId=${encodeURIComponent(productId)}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      toast.success(`Removed ${name} from your browsing history.`);
    } catch {
      setItems(previous);
      toast.error("Couldn't remove that item.");
    }
  }

  async function handleClearAll() {
    const ok = await confirm({
      title: "Remove all items?",
      description:
        "This permanently deletes everything in your browsing history. It can't be undone, and 'Continue shopping' will be empty until you view more products.",
      confirmLabel: "Remove all items",
      tone: "danger",
    });
    if (!ok) return;

    setBusy(true);
    const toastId = toast.loading("Clearing your browsing history...");
    try {
      const res = await fetch("/api/user/browsing-history", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setItems([]);
      clearRecentlyViewed();
      toast.success(data.message, { id: toastId });
    } catch (e) {
      toast.error(e.message || "Couldn't clear your history.", { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="animate-pulse text-sm font-medium text-[#0f1111]">
          Loading your browsing history...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {confirmDialog}

      <PageReveal>
        <h1 className="text-[28px] font-bold leading-none text-[#0f1111]">
          Browsing History
        </h1>
        <p className="mt-2 text-sm text-[#3f4545]">
          <Link
            href="/dashboard"
            className="text-[#007185] transition hover:text-[#c7511f] hover:underline"
          >
            Your Account
          </Link>{" "}
          › Browsing History
        </p>
      </PageReveal>

      {/* Recording switch + clear-all */}
      <FadeIn className="rounded-md border border-border bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1111]">
              <History className="size-4 text-[#565959]" />
              Keep a browsing history
            </h2>
            <p className="mt-1.5 max-w-xl text-xs leading-5 text-[#565959]">
              We record the products you view so we can show them back to you
              under &ldquo;Continue shopping&rdquo;. Your history is tied to your
              account, so it follows you to any device you sign in on. Turning
              this off stops the recording everywhere — your existing history is
              kept until you remove it below.
            </p>
          </div>

          {/* Switch. A real checkbox underneath, so it is keyboard-reachable and
              announced correctly; the visuals are painted on the label. */}
          <label
            className={`inline-flex shrink-0 cursor-pointer items-center gap-2.5 ${
              busy ? "pointer-events-none opacity-60" : ""
            }`}
          >
            <span className="text-xs font-bold text-[#0f1111]">
              {enabled ? "On" : "Off"}
            </span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={handleToggle}
              disabled={busy}
              className="peer sr-only"
            />
            {/* Track + knob are driven from `enabled` rather than `peer-checked:`
                — the knob is a descendant of the input's sibling, not a sibling
                itself, so the peer variant would never reach it. The peer is
                still what carries the focus ring onto the track. */}
            <span
              className={`relative block h-6 w-11 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-700 peer-focus-visible:ring-offset-2 ${
                enabled ? "bg-emerald-700" : "bg-[#d5d9d9]"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform ${
                  enabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </span>
          </label>
        </div>

        {items.length > 0 ? (
          <div className="mt-4 border-t border-[#d5d9d9] pt-4">
            <button
              type="button"
              onClick={handleClearAll}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded border border-[#d5d9d9] px-3 py-1.5 text-xs font-semibold text-[#0f1111] transition hover:bg-[#f7fafa] disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Trash2 className="size-3.5" />
              )}
              Remove all items
            </button>
          </div>
        ) : null}
      </FadeIn>

      {/* The history itself */}
      {items.length === 0 ? (
        <FadeIn className="rounded-md border border-border bg-white p-10 text-center shadow-sm">
          <History className="mx-auto size-8 text-[#d5d9d9]" />
          <p className="mt-3 text-sm font-bold text-[#0f1111]">
            No browsing history yet
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-[#565959]">
            {enabled
              ? "Products you view will show up here, and under “Continue shopping” on the home page."
              : "Browsing history is turned off, so nothing is being recorded."}
          </p>
          <Link
            href="/products"
            className="mt-4 inline-block text-sm font-semibold text-[#007185] transition hover:text-[#c7511f] hover:underline"
          >
            Browse products
          </Link>
        </FadeIn>
      ) : (
        <FadeIn className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
          <div className="border-b border-[#d5d9d9] px-5 py-3">
            <p className="text-xs font-bold text-[#0f1111]">
              {items.length} product{items.length === 1 ? "" : "s"}
              <span className="ml-1 font-medium text-[#565959]">
                · most recent first
              </span>
            </p>
          </div>

          <ul>
            {items.map((item) => {
              const product = item.product;
              const media = product.images?.[0];
              return (
                <li
                  key={product.id}
                  className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 last:border-0 sm:gap-4 sm:px-5"
                >
                  <Link
                    href={`/products/${product.slug}`}
                    className="relative size-14 shrink-0 overflow-hidden rounded border border-border bg-[#f7fafa] sm:size-16"
                  >
                    {media ? (
                      <ProductMedia
                        media={media}
                        alt={product.name}
                        fit={media.mediaType === "VIDEO" ? "cover" : "contain"}
                        sizes="64px"
                      />
                    ) : null}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/products/${product.slug}`}
                      className="line-clamp-2 text-sm font-semibold text-[#0f1111] transition hover:text-[#c7511f] hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-[#565959]">
                      {timeAgo(item.viewedAt)}
                      {product.price != null ? (
                        <span className="ml-2 font-bold text-[#0f1111]">
                          Rs. {Number(product.price).toLocaleString("en-IN")}
                        </span>
                      ) : null}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemove(product.id, product.name)}
                    aria-label={`Remove ${product.name} from browsing history`}
                    title="Remove from history"
                    className="flex size-8 shrink-0 items-center justify-center rounded text-[#565959] transition hover:bg-slate-50 hover:text-rose-700"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        </FadeIn>
      )}
    </div>
  );
}
