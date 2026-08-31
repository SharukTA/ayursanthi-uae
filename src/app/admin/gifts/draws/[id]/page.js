"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarClock,
  Loader2,
  Lock,
  Mail,
  Plus,
  Save,
  Send,
  Shuffle,
  Trash2,
  Trophy,
  Users,
  Gift,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ConfirmDialog";
import { ImageListField } from "@/components/ImageListField";
import { formatDrawDate, GIFT_FULFILMENT_STATUSES } from "@/lib/gift-shared";

/** The prize's cover, or a muted placeholder when its gallery is still empty. */
function PoolThumb({ src, alt }) {
  if (!src) {
    return (
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-slate-300"
        title="No image yet — add one on the Prizes tab."
        aria-hidden="true"
      >
        <Gift className="size-4" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="size-9 shrink-0 rounded border border-slate-200 object-cover"
    />
  );
}

/**
 * Create a prize without leaving the draw.
 *
 * Assembling a draw is when you discover the prize you want is not in the
 * catalogue yet, and sending the admin to another tab at that moment loses the
 * half-filled pool they were building. It posts to the ordinary prizes endpoint
 * — no special route, so a prize created here is identical to one created on the
 * Prizes tab — then hands the new id back so the caller can drop it straight
 * into the pool.
 */
function NewPrizeForm({ onCreated }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ name: "", valueNote: "", images: [] });
  const [saving, setSaving] = useState(false);

  async function create() {
    if (!draft.name.trim()) return toast.error("A prize name is required.");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/gifts/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not add the prize.");
      toast.success(`"${body.prize.name}" added to the catalogue.`);
      setDraft({ name: "", valueNote: "", images: [] });
      setOpen(false);
      await onCreated(body.prize);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  const field =
    "min-h-9 w-full rounded border border-input bg-white px-2 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="justify-self-start text-[11px] font-bold text-emerald-800 hover:underline"
      >
        <Plus className="mr-1 inline size-3" />
        New prize (with images)
      </button>
    );
  }

  return (
    <div className="grid gap-3 rounded border border-slate-200 bg-slate-50/60 p-3">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        New prize — added to the catalogue and to this draw
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-[11px] font-semibold text-slate-800">
          Name
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="iPhone 18"
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[11px] font-semibold text-slate-800">
          Value note
          <input
            value={draft.valueNote}
            onChange={(e) => setDraft({ ...draft, valueNote: e.target.value })}
            placeholder="AED 5,000"
            className={field}
          />
        </label>
      </div>

      <ImageListField
        label="Images"
        value={draft.images}
        onChange={(images) => setDraft({ ...draft, images })}
        disabled={saving}
        hint="Upload as many as you like — the first is the cover. You can add or reorder them later on the Prizes tab."
      />

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={saving}
          className="text-[11px] font-bold text-slate-500 hover:underline"
        >
          Cancel
        </button>
        <Button type="button" size="sm" disabled={saving} onClick={create}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Create and add
        </Button>
      </div>
    </div>
  );
}

// One gift draw, start to finish.
//
// The page is built around the fact that the lifecycle is one-way: close the
// entries, draw the winners, publish them. Each step is destructive of the last
// (a frozen list cannot reopen, a drawn result cannot be re-rolled), so each is
// behind its own confirmation and the prize editor disappears the moment the
// draw has been run.

const STEP_COPY = {
  SCHEDULED: {
    action: "freeze",
    label: "Close entries",
    icon: Lock,
    title: "Close the entry list?",
    body: "This takes a permanent snapshot of every coupon that qualified this cycle. Entries stop accruing and the list cannot be reopened. You should rarely see this step — the list closes by itself the moment the draw date passes, so this is only here for a cycle that somehow stayed open.",
  },
  FROZEN: {
    action: "run",
    label: "Run the draw",
    icon: Shuffle,
    title: "Run the draw?",
    body: "Winners are picked at random from the frozen list and cannot be re-rolled. Anyone who referred a winner is recorded as owed the same prize. Nothing is shown to customers until you publish.",
  },
  DRAWN: {
    action: "publish",
    label: "Publish winners",
    icon: Send,
    title: "Publish these winners?",
    body: "The winners become visible on the public gifts page and in each winner's dashboard. Check the list first — this is the store committing to it in public.",
  },
};

const STATUS_STYLES = {
  SCHEDULED: "bg-sky-50 text-sky-800 border-sky-200",
  FROZEN: "bg-amber-50 text-amber-800 border-amber-200",
  DRAWN: "bg-violet-50 text-violet-800 border-violet-200",
  PUBLISHED: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-md border border-border bg-white p-4 shadow-sm">
      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] font-normal text-slate-500">{hint}</p> : null}
    </div>
  );
}

export default function AdminDrawPage({ params }) {
  const { id } = use(params);

  const [data, setData] = useState(null);
  const [prizeRows, setPrizeRows] = useState([]);
  const [oneWin, setOneWin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirm, confirmDialog] = useConfirm();

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/gifts/draws/${id}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.message || "Could not load the draw.");
      return;
    }
    setData(body);
    setPrizeRows(body.draw.prizes.map((p) => ({ prizeId: p.prizeId, quantity: p.quantity })));
    setOneWin(body.draw.oneWinPerCustomer);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function savePrizes() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/gifts/draws/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prizes: prizeRows.filter((row) => row.prizeId),
          oneWinPerCustomer: oneWin,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not save the prizes.");
      toast.success("Prize pool saved.");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function advance(stepCopy) {
    // Every transition here is one-way, so each goes through the same
    // confirmation rather than firing off a single click.
    const ok = await confirm({
      title: stepCopy.title,
      description: stepCopy.body,
      confirmLabel: stepCopy.label,
      tone: "default",
    });
    if (!ok) return;

    setBusy(true);
    try {
      const res = await fetch(`/api/admin/gifts/draws/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: stepCopy.action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not update the draw.");
      toast.success(body.note || "Done.");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  // No confirmation: re-sending only ever reaches winners still marked PENDING,
  // so the worst case is that nothing happens.
  async function notifyWinners() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/gifts/draws/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "notify" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not email the winners.");
      toast.success(body.note || "Winners emailed.");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function updateWinner(winnerId, patch) {
    const res = await fetch(`/api/admin/gifts/winners/${winnerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(body.message || "Could not update the winner.");
    await load();
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-50 text-white flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-semibold text-slate-500">Loading draw...</p>
        </div>
        <SiteFooter />
      </main>
    );
  }

  const { draw, prizes, liveEntryCount } = data;
  const step = STEP_COPY[draw.status];
  const StepIcon = step?.icon;
  const editable = draw.status === "SCHEDULED" || draw.status === "FROZEN";
  // Nothing may be closed or drawn before the draw date. The server refuses it
  // outright (freezeDraw and runDraw in lib/gift-draw.js) and also decides this
  // flag, so the button is greyed out by the same clock that would reject the
  // request — comparing against the admin's own would let a fast machine offer a
  // button the server then refuses.
  const tooEarly = data.tooEarly;
  const prizeUnits = prizeRows.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  // PENDING is the pre-email state; anything past it means the winner was told.
  const unnotified = draw.winners.filter((winner) => winner.status === "PENDING").length;
  const field =
    "min-h-9 rounded border border-input bg-white px-2 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700";

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="bg-slate-950 py-8 text-white">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <PageReveal>
            <Link
              href="/admin/gifts"
              className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white"
            >
              <ArrowLeft className="size-3" />
              All gifts
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-white">
                <Trophy className="size-7 text-emerald-400" />
                Draw {draw.cycleKey}
              </h1>
              <span
                className={`rounded border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${STATUS_STYLES[draw.status]}`}
              >
                {draw.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-300">
              Held {formatDrawDate(draw.drawDate)} · qualifying window{" "}
              {formatDrawDate(draw.cycleStart)} to {formatDrawDate(draw.cycleEnd)}
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat
            label="Entries"
            value={draw.status === "SCHEDULED" ? (liveEntryCount ?? 0) : draw.entryCount}
            hint={draw.status === "SCHEDULED" ? "Still accruing" : "Frozen"}
          />
          <Stat label="Prize units" value={prizeUnits} />
          <Stat label="Winners" value={draw.winners.length} />
          <Stat
            label="Run by"
            value={draw.drawnBy?.name ?? "—"}
            hint={draw.drawnAt ? formatDrawDate(draw.drawnAt) : "Not yet run"}
          />
        </div>

        {step ? (
          <FadeIn
            className={`mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border-2 p-4 ${
              tooEarly ? "border-slate-200 bg-slate-50" : "border-emerald-200 bg-emerald-50/50"
            }`}
          >
            <div>
              <p className="text-sm font-bold text-slate-900">
                {tooEarly ? "Not yet — this draw opens on its draw date" : step.title.replace("?", "")}
              </p>
              <p className="mt-0.5 max-w-2xl text-[11px] font-normal text-slate-600">
                {tooEarly ? (
                  <>
                    Entries stay open until{" "}
                    <strong className="font-bold text-slate-900">
                      {formatDrawDate(draw.drawDate)}
                    </strong>
                    , and nothing can be closed or drawn before then. Customers have been told that
                    date, so closing early would drop everyone who buys between now and it. If the
                    date itself is wrong, change the draw day in{" "}
                    <Link href="/admin/settings" className="font-bold text-emerald-800 underline">
                      Settings
                    </Link>
                    .
                  </>
                ) : (
                  step.body
                )}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => advance(step)}
              disabled={busy || tooEarly}
              title={
                tooEarly
                  ? `Available from ${formatDrawDate(draw.drawDate)}`
                  : undefined
              }
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : tooEarly ? (
                <CalendarClock className="size-4" />
              ) : (
                <StepIcon className="size-4" />
              )}
              {tooEarly ? formatDrawDate(draw.drawDate) : step.label}
            </Button>
          </FadeIn>
        ) : (
          <FadeIn className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50/50 p-4">
            <div>
              <p className="text-sm font-bold text-emerald-900">
                Published {draw.publishedAt ? formatDrawDate(draw.publishedAt) : ""}
              </p>
              <p className="mt-0.5 text-[11px] font-normal text-slate-600">
                Live on the public gifts page and in each winner&apos;s dashboard.{" "}
                {unnotified > 0
                  ? `${unnotified} winner${unnotified === 1 ? " has" : "s have"} not been emailed yet.`
                  : "Every winner has been emailed."}
              </p>
            </div>
            {/* Only offered when somebody was actually missed — the send runs
                automatically on publish, and a button that usually does nothing
                invites clicking it to see what happens. */}
            {unnotified > 0 ? (
              <Button
                type="button"
                onClick={() => notifyWinners()}
                disabled={busy}
                size="sm"
              >
                {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Mail className="size-3.5" />}
                Email {unnotified} winner{unnotified === 1 ? "" : "s"}
              </Button>
            ) : null}
          </FadeIn>
        )}

        {/* Prize pool */}
        <FadeIn className="mt-5 rounded-md border border-border bg-white p-4 shadow-sm">
          <h2 className="text-xs font-black uppercase tracking-wide text-slate-500">Prize pool</h2>
          {!editable ? (
            <div className="mt-3 grid gap-1.5">
              {draw.prizes.map((row) => (
                <div key={row.id} className="flex items-center gap-2">
                  <PoolThumb src={row.prize.images?.[0]?.url} alt={row.prize.name} />
                  <p className="text-xs font-semibold text-slate-800">
                    {row.prize.name} <span className="text-slate-500">× {row.quantity}</span>
                  </p>
                </div>
              ))}
              <p className="mt-1 text-[10px] font-normal text-slate-500">
                Locked — the draw has been run.
              </p>
            </div>
          ) : (
            <>
              <div className="mt-3 grid gap-2">
                {prizeRows.map((row, index) => {
                  // Looked up rather than stored on the row: the pool holds ids,
                  // and the catalogue is what knows what each one looks like.
                  const picked = prizes.find((prize) => prize.id === row.prizeId);
                  return (
                  <div key={index} className="flex items-center gap-2">
                    {row.prizeId ? (
                      <PoolThumb src={picked?.images?.[0]?.url} alt={picked?.name ?? ""} />
                    ) : null}
                    <select
                      value={row.prizeId}
                      onChange={(e) => {
                        const next = [...prizeRows];
                        next[index] = { ...next[index], prizeId: e.target.value };
                        setPrizeRows(next);
                      }}
                      className={`${field} flex-1`}
                    >
                      <option value="">Select a prize...</option>
                      {prizes.map((prize) => (
                        <option key={prize.id} value={prize.id}>
                          {prize.name}
                          {prize.valueNote ? ` — ${prize.valueNote}` : ""}
                          {(prize.images?.length ?? 0) === 0 ? " (no image)" : ""}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={row.quantity}
                      onChange={(e) => {
                        const next = [...prizeRows];
                        next[index] = { ...next[index], quantity: e.target.value };
                        setPrizeRows(next);
                      }}
                      className={`${field} w-20`}
                    />
                    <button
                      type="button"
                      onClick={() => setPrizeRows(prizeRows.filter((_, i) => i !== index))}
                      className="text-rose-600"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setPrizeRows([...prizeRows, { prizeId: "", quantity: 1 }])}
                  className="justify-self-start text-[11px] font-bold text-emerald-800 hover:underline"
                >
                  <Plus className="mr-1 inline size-3" />
                  Add prize from the catalogue
                </button>

                {/* Reloads the page data so the new prize is in the dropdown,
                    then appends it to the pool — otherwise the admin would have
                    just created it and still have to find it in a list. */}
                <NewPrizeForm
                  onCreated={async (prize) => {
                    await load();
                    setPrizeRows((rows) => [...rows, { prizeId: prize.id, quantity: 1 }]);
                  }}
                />
              </div>

              <label className="mt-4 flex items-start gap-2 border-t border-slate-100 pt-3 text-[11px] font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={oneWin}
                  onChange={(e) => setOneWin(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  One prize per customer
                  <span className="block font-normal text-slate-500">
                    Holding more coupons still improves the chance of being drawn — this only stops
                    one person taking several prizes from the same draw.
                  </span>
                </span>
              </label>

              <div className="mt-3 flex justify-end">
                <Button type="button" size="sm" onClick={savePrizes} disabled={busy}>
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                  Save pool
                </Button>
              </div>
            </>
          )}
        </FadeIn>

        {/* Winners */}
        {draw.winners.length > 0 ? (
          <FadeIn className="mt-5 overflow-x-auto rounded-md border border-border bg-white shadow-sm">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2.5">Prize</th>
                  <th className="px-4 py-2.5">Who</th>
                  <th className="px-4 py-2.5">Why</th>
                  <th className="px-4 py-2.5">Coupon</th>
                  <th className="px-4 py-2.5">Fulfilment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {draw.winners.map((winner) => (
                  <tr
                    key={winner.id}
                    className={winner.kind === "REFERRER" ? "bg-slate-50/60" : ""}
                  >
                    <td className="px-4 py-3 font-bold text-slate-900">{winner.prize.name}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{winner.user.name}</p>
                      <p className="text-[10px] text-slate-500">{winner.user.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      {winner.kind === "PRIMARY" ? (
                        <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-emerald-800">
                          Drawn
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-sky-800">
                          <Users className="size-2.5" />
                          Referrer
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[10px] text-slate-600">
                      {winner.coupon?.code ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={winner.status}
                        onChange={(e) => updateWinner(winner.id, { status: e.target.value })}
                        className={field}
                      >
                        {GIFT_FULFILMENT_STATUSES.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </FadeIn>
        ) : null}
      </section>

      {confirmDialog}

      <SiteFooter />
    </main>
  );
}
