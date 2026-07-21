"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upload } from "@vercel/blob/client";
import {
  Gift,
  Plus,
  ArrowLeft,
  Trash2,
  Pencil,
  Loader2,
  Eye,
  EyeOff,
  Truck,
  XCircle,
  ImagePlus,
  Users,
  Trophy,
  Dices,
  Lock,
  CheckCircle2,
  Repeat,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";

const STATUS_STYLES = {
  LOCKED: "bg-slate-100 text-slate-500 border border-slate-200",
  READY: "bg-amber-50 text-amber-800 border border-amber-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 border border-emerald-200",
};

export default function AdminGiftDrawsPage() {
  const router = useRouter();
  const [confirm, confirmDialog] = useConfirm();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [payingCount, setPayingCount] = useState(0);
  const [tiers, setTiers] = useState([]);
  const [wins, setWins] = useState([]);

  // Create-tier form
  const [threshold, setThreshold] = useState("");
  const [label, setLabel] = useState("");
  const [creatingTier, setCreatingTier] = useState(false);

  // Dialog state
  const [itemDialog, setItemDialog] = useState(null); // { tierId } (add) or { item } (edit)
  const [tierDialog, setTierDialog] = useState(null); // tier being edited
  const [shipWin, setShipWin] = useState(null);
  const [shipNote, setShipNote] = useState("");
  const [shipping, setShipping] = useState(false);
  const [drawingId, setDrawingId] = useState(null);

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
        await Promise.all([fetchTiers(), fetchWins()]);
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  async function fetchTiers() {
    try {
      const res = await fetch("/api/admin/gift-tiers");
      const data = await res.json();
      setTiers(data.tiers || []);
      setPayingCount(data.payingCount || 0);
    } catch {
      toast.error("Failed to load gift tiers.");
    }
  }

  async function fetchWins() {
    try {
      const res = await fetch("/api/admin/gift-wins");
      const data = await res.json();
      setWins(data.wins || []);
    } catch {
      toast.error("Failed to load gift wins.");
    }
  }

  async function handleCreateTier(e) {
    e.preventDefault();
    if (!threshold) {
      toast.error("A member threshold is required.");
      return;
    }
    setCreatingTier(true);
    const toastId = toast.loading("Adding tier...");
    try {
      const res = await fetch("/api/admin/gift-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberThreshold: threshold, label: label.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to create tier.");
      toast.success("Tier added.", { id: toastId });
      setThreshold("");
      setLabel("");
      await fetchTiers();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setCreatingTier(false);
    }
  }

  async function toggleTier(tier) {
    const toastId = toast.loading("Updating...");
    try {
      const res = await fetch(`/api/admin/gift-tiers/${tier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !tier.isActive }),
      });
      if (!res.ok) throw new Error("Failed to update tier.");
      toast.success(tier.isActive ? "Tier hidden." : "Tier live.", { id: toastId });
      await fetchTiers();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function deleteTier(tier) {
    const ok = await confirm({
      title: "Delete tier?",
      description: `"${tier.label || tier.memberThreshold + " members"}" and its gifts will be removed.${tier.drawnAt ? " Its draw results will also be deleted." : ""}`,
      confirmLabel: "Delete tier",
    });
    if (!ok) return;
    const toastId = toast.loading("Deleting...");
    try {
      const res = await fetch(`/api/admin/gift-tiers/${tier.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tier.");
      toast.success("Tier deleted.", { id: toastId });
      await Promise.all([fetchTiers(), fetchWins()]);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function deleteItem(item) {
    const ok = await confirm({
      title: "Delete gift?",
      description: `"${item.name}" will be removed from this tier.`,
      confirmLabel: "Delete gift",
    });
    if (!ok) return;
    const toastId = toast.loading("Deleting...");
    try {
      const res = await fetch(`/api/admin/gift-tier-items/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete gift.");
      toast.success("Gift deleted.", { id: toastId });
      await fetchTiers();
    } catch (error) {
      toast.error(error.message, { id: toastId });
    }
  }

  async function runDraw(tier) {
    const ok = await confirm({
      title: "Run this draw?",
      description: `This randomly selects winners for the ${tier.items.length} gift(s) in "${tier.label || tier.memberThreshold + " members"}" and cannot be undone. Each winner's direct referrer also receives the same gift.`,
      confirmLabel: "Run draw",
    });
    if (!ok) return;
    setDrawingId(tier.id);
    const toastId = toast.loading("Running the draw...");
    try {
      const res = await fetch(`/api/admin/gift-tiers/${tier.id}/draw`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Draw failed.");
      toast.success(data.message || "Draw complete.", { id: toastId });
      await Promise.all([fetchTiers(), fetchWins()]);
    } catch (error) {
      toast.error(error.message, { id: toastId });
    } finally {
      setDrawingId(null);
    }
  }

  // Save from add/edit gift dialog. Returns true on success.
  async function saveItem(values, existingId, tierId) {
    const url = existingId
      ? `/api/admin/gift-tier-items/${existingId}`
      : `/api/admin/gift-tiers/${tierId}/items`;
    const method = existingId ? "PATCH" : "POST";
    const toastId = toast.loading("Saving gift...");
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save gift.");
      toast.success("Gift saved.", { id: toastId });
      await fetchTiers();
      return true;
    } catch (error) {
      toast.error(error.message, { id: toastId });
      return false;
    }
  }

  async function saveTier(id, values) {
    const toastId = toast.loading("Saving tier...");
    try {
      const res = await fetch(`/api/admin/gift-tiers/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save tier.");
      toast.success("Tier saved.", { id: toastId });
      await fetchTiers();
      return true;
    } catch (error) {
      toast.error(error.message, { id: toastId });
      return false;
    }
  }

  async function patchWin(win, action, adminNote) {
    const toastId = toast.loading("Updating...");
    try {
      const res = await fetch(`/api/admin/gift-wins/${win.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, adminNote: adminNote || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update.");
      toast.success(action === "SHIPPED" ? "Marked as shipped." : "Win voided.", { id: toastId });
      await fetchWins();
      return true;
    } catch (error) {
      toast.error(error.message, { id: toastId });
      return false;
    }
  }

  async function confirmShip() {
    if (!shipWin) return;
    setShipping(true);
    const ok = await patchWin(shipWin, "SHIPPED", shipNote.trim());
    setShipping(false);
    if (ok) setShipWin(null);
  }

  async function rejectWin(win) {
    const ok = await confirm({
      title: "Void this win?",
      description: `"${win.giftName}" won by ${win.user?.name} will be voided and removed from the winner's rewards.`,
      confirmLabel: "Void win",
    });
    if (!ok) return;
    await patchWin(win, "REJECTED");
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

  const pendingWins = wins.filter((w) => w.status === "CLAIMED");
  const otherWins = wins.filter((w) => w.status !== "CLAIMED");

  // The next draw to fire: the un-drawn tier with the smallest threshold.
  const nextDrawTierId = tiers
    .filter((t) => t.status !== "COMPLETED")
    .sort((a, b) => a.memberThreshold - b.memberThreshold)[0]?.id;

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
              <Gift className="size-7 text-emerald-400" />
              Gift Draws
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Build milestone tiers and their gifts. When enough customers have paid, a
              tier turns <span className="font-semibold text-amber-300">READY</span> — run the draw to pick
              random eligible winners. Each winner&apos;s direct referrer wins the same gift too.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-2 text-sm font-bold">
              <Users className="size-4 text-emerald-300" />
              {payingCount.toLocaleString()} paying customer{payingCount === 1 ? "" : "s"} so far
            </div>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full flex flex-col gap-10">
        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          {/* Create tier */}
          <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm h-fit">
            <h2 className="text-base font-bold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
              <Plus className="size-5 text-emerald-700" />
              Add Milestone Tier
            </h2>
            <form onSubmit={handleCreateTier} className="mt-5 grid gap-4">
              <label className="grid gap-2 text-xs font-semibold text-slate-800">
                Paying members needed *
                <input
                  type="number"
                  min="1"
                  value={threshold}
                  onChange={(e) => setThreshold(e.target.value)}
                  disabled={creatingTier}
                  placeholder="100"
                  className="w-full min-h-10 rounded border border-input bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700"
                />
              </label>
              <label className="grid gap-2 text-xs font-semibold text-slate-800">
                Label (optional)
                <input
                  type="text"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  disabled={creatingTier}
                  placeholder="100 Members"
                  className="w-full min-h-10 rounded border border-input bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700"
                />
              </label>
              <p className="-mt-2 text-[10px] text-slate-500">
                The draw for this tier unlocks once this many customers have made a paid purchase.
              </p>
              <Button type="submit" disabled={creatingTier} className="h-10 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold mt-1">
                {creatingTier ? <><Loader2 className="size-3 animate-spin mr-1.5" />Adding...</> : "Add Tier"}
              </Button>
            </form>
          </FadeIn>

          {/* Tier list */}
          <FadeIn className="flex flex-col gap-5">
            {tiers.length === 0 ? (
              <div className="rounded-md border border-border bg-white p-10 text-center shadow-sm">
                <p className="text-sm text-slate-500 italic">No tiers yet — add a milestone to start the gift draws.</p>
              </div>
            ) : (
              tiers.map((tier) => (
                <TierCard
                  key={tier.id}
                  tier={tier}
                  payingCount={payingCount}
                  isNext={tier.id === nextDrawTierId}
                  drawing={drawingId === tier.id}
                  onAddItem={() => setItemDialog({ tierId: tier.id })}
                  onEditItem={(item) => setItemDialog({ item })}
                  onDeleteItem={deleteItem}
                  onToggle={() => toggleTier(tier)}
                  onEdit={() => setTierDialog(tier)}
                  onDelete={() => deleteTier(tier)}
                  onRunDraw={() => runDraw(tier)}
                />
              ))
            )}
          </FadeIn>
        </div>

        {/* Fulfillment queue */}
        <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
          <h2 className="text-base font-bold text-slate-950 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Truck className="size-5 text-emerald-700" />
            Gifts to Ship
            {pendingWins.length > 0 ? (
              <span className="inline-flex items-center rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold text-white">{pendingWins.length}</span>
            ) : null}
          </h2>

          {pendingWins.length === 0 ? (
            <p className="mt-5 text-sm text-slate-500 italic text-center py-6">No gifts waiting to be shipped right now.</p>
          ) : (
            <ul className="mt-5 grid gap-3">
              {pendingWins.map((w) => {
                const a = w.addressSnapshot || {};
                return (
                  <li key={w.id} className="rounded-md border border-amber-200 bg-amber-50/40 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                          <Gift className="size-4 text-emerald-700" /> {w.giftName}
                          {w.quantity > 1 ? <span className="text-emerald-700">×{w.quantity}</span> : null}
                          {w.isReferrerMirror ? (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700 border border-indigo-200">
                              <Repeat className="size-3" /> REFERRER BONUS
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          {w.isReferrerMirror ? "Referrer" : "Winner"}: <span className="font-semibold">{w.user?.name}</span> · {w.user?.email}
                          {w.user?.phone ? ` · ${w.user.phone}` : ""}
                        </p>
                        <p className="mt-1 text-xs text-slate-700">
                          <span className="font-semibold">Ship to:</span> {a.fullName}, {a.line1}
                          {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} — {a.postalCode}, {a.country}
                          {a.phone ? ` · ${a.phone}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button onClick={() => { setShipNote(""); setShipWin(w); }} className="h-9 rounded-md bg-emerald-700 hover:bg-emerald-800 text-xs font-semibold">
                          <Truck className="size-3.5 mr-1.5" /> Mark Shipped
                        </Button>
                        <button onClick={() => rejectWin(w)} className="inline-flex items-center gap-1 rounded-md border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50">
                          <XCircle className="size-3.5" /> Void
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {otherWins.length > 0 ? (
            <>
              <h3 className="mt-8 mb-3 text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                <Trophy className="size-3.5" /> All draw wins
              </h3>
              <ul className="grid gap-2">
                {otherWins.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 px-3 py-2 text-xs">
                    <span className="font-semibold text-slate-800">
                      {w.user?.name} — {w.giftName}{w.quantity > 1 ? ` ×${w.quantity}` : ""}
                      {w.isReferrerMirror ? <span className="ml-1 text-indigo-600">(referrer bonus)</span> : null}
                    </span>
                    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[9px] font-bold ${
                      w.status === "SHIPPED" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" :
                      w.status === "REJECTED" ? "bg-rose-50 text-rose-700 border border-rose-200" :
                      "bg-amber-50 text-amber-800 border border-amber-200"
                    }`}>
                      {w.status === "WON" ? "AWAITING ADDRESS" : w.status}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </FadeIn>
      </section>

      <SiteFooter />
      {confirmDialog}
      {shipWin ? (
        <ShipDialog win={shipWin} note={shipNote} setNote={setShipNote} busy={shipping} onConfirm={confirmShip} onCancel={() => !shipping && setShipWin(null)} />
      ) : null}
      {itemDialog ? (
        <ItemDialog
          item={itemDialog.item}
          tierId={itemDialog.tierId}
          onSave={saveItem}
          onCancel={() => setItemDialog(null)}
        />
      ) : null}
      {tierDialog ? (
        <TierDialog tier={tierDialog} onSave={saveTier} onCancel={() => setTierDialog(null)} />
      ) : null}
    </main>
  );
}

function TierCard({ tier, payingCount = 0, isNext = false, drawing, onAddItem, onEditItem, onDeleteItem, onToggle, onEdit, onDelete, onRunDraw }) {
  // Progress toward this tier's milestone (only meaningful before it's drawn).
  const pct =
    tier.memberThreshold > 0
      ? Math.min(100, Math.round((payingCount / tier.memberThreshold) * 100))
      : 0;
  const remaining = Math.max(0, tier.memberThreshold - payingCount);

  return (
    <div className={`rounded-md border bg-white p-5 shadow-sm ${isNext ? "border-amber-300 ring-1 ring-amber-200" : "border-border"}`}>
      <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 pb-3">
        <span className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[10px] font-bold ${STATUS_STYLES[tier.status]}`}>
          {tier.status === "COMPLETED" ? <CheckCircle2 className="size-3" /> : tier.status === "READY" ? <Dices className="size-3" /> : <Lock className="size-3" />}
          {tier.status}
        </span>
        {isNext ? (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">
            Next up
          </span>
        ) : null}
        <div className="min-w-0">
          <p className="text-base font-bold text-slate-900">{tier.label || `${tier.memberThreshold.toLocaleString()} Members`}</p>
          <p className="text-xs font-semibold text-slate-500">
            Draws at {tier.memberThreshold.toLocaleString()} paying members · {tier.items.length} gift{tier.items.length === 1 ? "" : "s"}
            {tier.drawnAt ? ` · drawn ${new Date(tier.drawnAt).toLocaleDateString()}` : ""}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          {!tier.isActive ? (
            <span className="inline-flex items-center rounded px-2 py-0.5 text-[9px] font-bold bg-slate-100 text-slate-500 border border-slate-200">HIDDEN</span>
          ) : null}
          <button onClick={onToggle} title={tier.isActive ? "Hide" : "Show"} className="inline-flex items-center justify-center rounded border border-slate-200 p-2 text-slate-600 hover:bg-slate-50">
            {tier.isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
          <button onClick={onEdit} title="Edit tier" className="inline-flex items-center justify-center rounded border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-emerald-700">
            <Pencil className="size-4" />
          </button>
          <button onClick={onDelete} title="Delete tier" className="inline-flex items-center justify-center rounded border border-rose-200 p-2 text-rose-600 hover:bg-rose-50">
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Milestone progress — how close this tier is to firing. */}
      {tier.status !== "COMPLETED" ? (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5 text-emerald-600" />
              {payingCount.toLocaleString()} / {tier.memberThreshold.toLocaleString()} paying customers
            </span>
            <span className="text-slate-400">{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full transition-all ${tier.status === "READY" ? "bg-amber-500" : "bg-emerald-600"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="mt-1.5 text-[11px] font-semibold text-slate-500">
            {tier.status === "READY"
              ? "Milestone reached — ready to run the draw."
              : `${remaining.toLocaleString()} more paying customer${remaining === 1 ? "" : "s"} to unlock.`}
          </p>
        </div>
      ) : null}

      {/* Gifts */}
      {tier.items.length === 0 ? (
        <p className="mt-4 text-xs text-slate-500 italic">No gifts yet — add the gifts awarded at this milestone.</p>
      ) : (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {tier.items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 rounded border border-slate-200 p-2.5">
              <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100 text-slate-500">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.imageUrl} alt={item.name} className="size-full object-cover" />
                ) : (
                  <Gift className="size-5" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {item.name} <span className="text-emerald-700">×{item.quantity}</span>
                </p>
                {item.description ? <p className="truncate text-[11px] text-slate-500">{item.description}</p> : null}
              </div>
              <button onClick={() => onEditItem(item)} title="Edit" className="inline-flex items-center justify-center rounded border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50">
                <Pencil className="size-3.5" />
              </button>
              <button onClick={() => onDeleteItem(item)} title="Delete" className="inline-flex items-center justify-center rounded border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button onClick={onAddItem} variant="outline" className="h-9 rounded-md border-slate-200 text-xs font-semibold text-slate-700">
          <Plus className="size-3.5 mr-1" /> Add gift
        </Button>
        {tier.status === "READY" && tier.items.length > 0 ? (
          <Button onClick={onRunDraw} disabled={drawing} className="h-9 rounded-md bg-amber-600 hover:bg-amber-700 text-xs font-semibold text-white">
            {drawing ? <Loader2 className="size-3.5 animate-spin mr-1" /> : <Dices className="size-3.5 mr-1" />}
            {drawing ? "Drawing..." : "Run draw"}
          </Button>
        ) : null}
        {tier.status === "COMPLETED" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="size-4" /> Draw completed
          </span>
        ) : null}
        {tier.status === "LOCKED" ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
            <Lock className="size-3.5" /> Milestone not reached yet
          </span>
        ) : null}
      </div>
    </div>
  );
}

// Shared image-upload block used by the gift dialog.
function ImageField({ imageUrl, setImageUrl, busy, id }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const toastId = toast.loading("Uploading image...");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/admin/upload",
        contentType: file.type,
      });
      setImageUrl(blob.url);
      toast.success("Image uploaded.", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Upload failed.", { id: toastId });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="grid gap-2 text-xs font-semibold text-slate-800">
      Gift image
      <div className="flex items-center gap-3">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50 text-slate-300">
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="Gift" className="size-full object-cover" />
          ) : (
            <Gift className="size-6" />
          )}
        </span>
        <div className="flex flex-col gap-1.5">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" id={id} />
          <Button type="button" variant="outline" disabled={uploading || busy} onClick={() => fileRef.current?.click()} className="h-9 rounded-md border-slate-200 text-xs font-semibold text-slate-700">
            {uploading ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : <ImagePlus className="size-3.5 mr-1.5" />}
            {uploading ? "Uploading..." : "Upload image"}
          </Button>
          {imageUrl ? (
            <button type="button" onClick={() => setImageUrl("")} className="text-[10px] font-semibold text-rose-600 hover:underline text-left">
              Remove image
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function useModalChrome(onCancel, busy) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [busy, onCancel]);
}

// Add or edit a gift line. `item` present => edit; otherwise add to `tierId`.
function ItemDialog({ item, tierId, onSave, onCancel }) {
  const [name, setName] = useState(item?.name ?? "");
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [quantity, setQuantity] = useState(String(item?.quantity ?? "1"));
  const [description, setDescription] = useState(item?.description ?? "");
  const [busy, setBusy] = useState(false);
  useModalChrome(onCancel, busy);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim() || !quantity) {
      toast.error("Gift name and quantity are required.");
      return;
    }
    setBusy(true);
    const ok = await onSave(
      { name: name.trim(), imageUrl: imageUrl || "", description: description.trim() || "", quantity },
      item?.id,
      tierId
    );
    setBusy(false);
    if (ok) onCancel();
  }

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Gift className="size-5 text-emerald-700" /> {item ? "Edit gift" : "Add gift"}
        </h2>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-xs font-semibold text-slate-800">
            Gift name *
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={busy} placeholder="Smart Watch" className="w-full min-h-10 rounded border border-input bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700" />
          </label>
          <ImageField imageUrl={imageUrl} setImageUrl={setImageUrl} busy={busy} id="gift-item-img" />
          <label className="grid gap-2 text-xs font-semibold text-slate-800">
            Quantity (units the winner &amp; referrer each receive) *
            <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={busy} placeholder="1" className="w-full min-h-10 rounded border border-input bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700" />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-slate-800">
            Description
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} rows={2} placeholder="Optional details" className="w-full rounded border border-input bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-emerald-700" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" disabled={busy} className="bg-emerald-700 hover:bg-emerald-800">
            {busy ? <><Loader2 className="size-4 animate-spin" />Saving...</> : "Save gift"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function TierDialog({ tier, onSave, onCancel }) {
  const [memberThreshold, setMemberThreshold] = useState(String(tier.memberThreshold ?? ""));
  const [label, setLabel] = useState(tier.label ?? "");
  const [busy, setBusy] = useState(false);
  useModalChrome(onCancel, busy);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!memberThreshold) {
      toast.error("Member threshold is required.");
      return;
    }
    setBusy(true);
    const ok = await onSave(tier.id, { memberThreshold, label: label.trim() });
    setBusy(false);
    if (ok) onCancel();
  }

  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <form onSubmit={handleSubmit} className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-150">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Pencil className="size-5 text-emerald-700" /> Edit tier
        </h2>
        <div className="mt-5 grid gap-4">
          <label className="grid gap-2 text-xs font-semibold text-slate-800">
            Paying members needed *
            <input type="number" min="1" value={memberThreshold} onChange={(e) => setMemberThreshold(e.target.value)} disabled={busy} className="w-full min-h-10 rounded border border-input bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700" />
          </label>
          <label className="grid gap-2 text-xs font-semibold text-slate-800">
            Label
            <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} disabled={busy} placeholder="100 Members" className="w-full min-h-10 rounded border border-input bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700" />
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button type="submit" size="sm" disabled={busy} className="bg-emerald-700 hover:bg-emerald-800">
            {busy ? <><Loader2 className="size-4 animate-spin" />Saving...</> : "Save changes"}
          </Button>
        </div>
      </form>
    </div>,
    document.body
  );
}

function ShipDialog({ win, note, setNote, busy, onConfirm, onCancel }) {
  useModalChrome(onCancel, busy);
  const address = win.addressSnapshot || {};
  return createPortal(
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => !busy && onCancel()} />
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-teal-100 text-[#0f1111]">
            <Truck className="size-5" />
          </span>
          <div className="flex-1 pt-0.5">
            <h2 className="text-base font-bold text-slate-900">Mark &quot;{win.giftName}&quot; as shipped</h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              Shipping to <span className="font-semibold">{address.fullName}</span> — {address.city}, {address.state}.
            </p>
          </div>
        </div>
        <label className="mt-5 grid gap-2 text-xs font-semibold text-slate-800">
          Tracking number / note (optional)
          <input type="text" value={note} autoFocus disabled={busy} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !busy) onConfirm(); }} placeholder="e.g. BlueDart 1234567890" className="w-full min-h-10 rounded border border-input bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-emerald-700" />
          <span className="text-[10px] font-normal text-slate-500">Shown to the customer on their rewards page.</span>
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <Button type="button" variant="secondary" size="sm" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button type="button" size="sm" disabled={busy} onClick={onConfirm} className="bg-emerald-700 hover:bg-emerald-800">
            {busy ? <><Loader2 className="size-4 animate-spin" />Shipping...</> : <><Truck className="size-4" />Mark Shipped</>}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
