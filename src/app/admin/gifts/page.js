"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  Gift,
  Image as ImageIcon,
  Loader2,
  Plus,
  Save,
  Trash2,
  Trophy,
  Table2,
  Package,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { ImageUrlField } from "@/components/ImageUrlField";
import { ImageListField } from "@/components/ImageListField";
import {
  DEFAULT_DRAW_TIME,
  GIFT_POSTER_PLACEMENTS,
  formatDrawDateTime,
  nowDrawTime,
  toDrawDateInput,
  toDrawTimeInput,
  todayDrawDate,
} from "@/lib/gift-shared";

// Admin console for the gift draw programme, in four parts:
//
//   Draws    the schedule (when the next draw is held, and whether the
//            programme is running at all) plus the draws themselves. Each draw
//            opens its own page, because running one is a sequence of decisions
//            rather than a form.
//   Posters  the campaign artwork the storefront shows. This is what customers
//            actually read — /gifts carries almost no copy of its own.
//   Prizes   the shared catalogue — one row per real prize, used by both the
//            roadmap and the draws.
//   Roadmap  the long-term prize plan. Content only, and currently not shown on
//            /gifts — kept here so the data survives until it is wanted again.
//
// One page with tabs rather than four routes: they are read together constantly
// (you add a prize in order to put it in a draw) and splitting them would mean
// four loads and four back buttons for one task.

const TABS = [
  { id: "draws", label: "Draws", icon: Trophy },
  { id: "posters", label: "Posters", icon: ImageIcon },
  { id: "prizes", label: "Prizes", icon: Package },
  { id: "roadmap", label: "Roadmap", icon: Table2 },
];

const STATUS_STYLES = {
  SCHEDULED: "bg-sky-50 text-sky-800 border-sky-200",
  FROZEN: "bg-amber-50 text-amber-800 border-amber-200",
  DRAWN: "bg-violet-50 text-violet-800 border-violet-200",
  PUBLISHED: "bg-emerald-50 text-emerald-800 border-emerald-200",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-block rounded border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${
        STATUS_STYLES[status] ?? "bg-slate-50 text-slate-700 border-slate-200"
      }`}
    >
      {status}
    </span>
  );
}

/* ─── Draws ──────────────────────────────────────────────────────────────── */

/**
 * The schedule: when the next draw is held, and whether the programme is
 * running at all.
 *
 * Both live in site settings, but this is where they are actually used, so this
 * is where they are edited — an admin looking at a list of draws should not have
 * to go to another screen to say when the next one is. It writes through the
 * ordinary settings endpoint with just these two keys; that route upserts only
 * what it is given, so nothing else in Settings is touched.
 *
 * The date input is a native calendar with `min` pinned to today in the store's
 * timezone: a draw can be scheduled for today or any later day, never for one
 * that has already gone. Scheduling a past date would create a draw the nightly
 * job freezes on its very next run, closing a giveaway nobody was ever told
 * about.
 */
function ScheduleCard({ data, onSaved }) {
  const [drawDate, setDrawDate] = useState(data.drawDate ?? "");
  const [drawTime, setDrawTime] = useState(data.drawTime ?? DEFAULT_DRAW_TIME);
  const [enabled, setEnabled] = useState(data.programEnabled);
  const [saving, setSaving] = useState(false);

  // Recomputed per render rather than stored: a console left open overnight
  // would otherwise keep offering yesterday as a legal choice.
  const earliest = todayDrawDate();
  const dirty =
    drawDate !== (data.drawDate ?? "") ||
    drawTime !== (data.drawTime ?? DEFAULT_DRAW_TIME) ||
    enabled !== data.programEnabled;

  async function save() {
    if (drawDate && drawDate < earliest) {
      toast.error("The draw date cannot be in the past.");
      return;
    }
    // The date input's `min` cannot express "and not an hour that has already
    // gone", so today needs the extra check — otherwise a draw could be booked
    // for 9am this morning and the nightly job would close it on its next run.
    if (drawDate === earliest && drawTime && drawTime <= nowDrawTime()) {
      toast.error("That time has already passed today. Pick a later time, or a later date.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            gift_draw_date: drawDate,
            gift_draw_time: drawTime,
            gift_program_enabled: enabled ? "true" : "false",
          },
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not save the schedule.");
      toast.success("Schedule saved.");
      await onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-border bg-white p-4 shadow-sm">
      <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wide text-slate-500">
        <CalendarDays className="size-3.5" />
        Schedule
      </h3>

      <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
        <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
          Next draw date
          <input
            type="date"
            value={drawDate}
            min={earliest}
            onChange={(e) => setDrawDate(e.target.value)}
            disabled={saving}
            className="min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
          Draw time
          <input
            type="time"
            value={drawTime}
            onChange={(e) => setDrawTime(e.target.value)}
            disabled={saving}
            className="min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700"
          />
        </label>

        <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
          Giveaway
          <select
            value={enabled ? "true" : "false"}
            onChange={(e) => setEnabled(e.target.value === "true")}
            disabled={saving}
            className="min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </label>

        <Button type="button" size="sm" className="h-10" disabled={saving || !dirty} onClick={save}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
          Save
        </Button>
      </div>

      <p className="mt-2.5 text-[11px] font-normal text-slate-500">
        Gulf time, on a 24-hour clock — 13:00 is 1:00 PM. The date and time together are the entry
        cutoff: everything bought before that instant is in this draw, everything from it onwards
        goes to the next one. So a giveaway advertised for 1:00 PM should say 13:00 here, or a whole
        day of shoppers who did what the poster told them is shut out.
      </p>
      <p className="mt-1 text-[11px] font-normal text-slate-500">
        Moving either one moves that cutoff, and the earliest moment the draw can be run, for the
        draw not yet closed. Draws already closed keep the dates they ran on, so a result that has
        been decided is never rewritten.
      </p>
      <p className="mt-1 text-[11px] font-normal text-slate-500">
        Setting the giveaway to <strong>Inactive</strong> stops new coupons being minted and stops
        the storefront advertising a draw. Coupons already issued are untouched and keep their place
        in the next one.
      </p>

      {/* Two states worth flagging out loud, because in both of them the store
          is quietly advertising nothing and nobody would otherwise notice. */}
      {data.drawPassed ? (
        <p className="mt-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-900">
          The scheduled date has passed. Pick the next one — until then the gifts page shows no draw
          date, and the nightly job will not open a new draw.
        </p>
      ) : null}
      {!data.programEnabled ? (
        <p className="mt-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-700">
          The giveaway is inactive. No coupons are being minted and the gifts page says the
          programme is paused.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Move one draw's date and time, from its own row in the list.
 *
 * The Schedule card at the top edits the same two values, and both write through
 * to the same place — this is not a second source of truth, it is the same one
 * reached from where an admin is actually looking when they decide a draw needs
 * moving. The endpoint updates the settings as well as the row, so the two
 * screens can never disagree about when the next draw is.
 *
 * Only offered for a SCHEDULED draw. Once the entry list has closed the date is
 * a promise already kept to whoever was in it, and the server refuses to move it
 * regardless of what this form sends.
 */
function DrawScheduleEditor({ draw, onSaved, onCancel }) {
  // Seeded from the draw's own stored instant rather than from the settings, so
  // the form opens showing what THIS row actually says.
  const [date, setDate] = useState(toDrawDateInput(draw.drawDate));
  const [time, setTime] = useState(toDrawTimeInput(draw.drawDate));
  const [saving, setSaving] = useState(false);

  const earliest = todayDrawDate();

  async function save() {
    if (date < earliest) {
      toast.error("The draw date cannot be in the past.");
      return;
    }
    // `min` on a date input cannot express "and not an hour that has already
    // gone", so today needs the extra check.
    if (date === earliest && time <= nowDrawTime()) {
      toast.error("That time has already passed today. Pick a later time, or a later date.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/gifts/draws/${draw.id}/schedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ drawDate: date, drawTime: time }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not move the draw.");
      toast.success(body.message || "Draw moved.");
      await onSaved();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const field =
    "min-h-9 rounded border border-input bg-white px-2 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700";

  return (
    <div className="flex flex-wrap items-end gap-2 border-l-2 border-emerald-600 bg-slate-50 px-4 py-3">
      <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
        Date
        <input
          type="date"
          value={date}
          min={earliest}
          onChange={(e) => setDate(e.target.value)}
          disabled={saving}
          className={field}
        />
      </label>
      <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
        Time
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          disabled={saving}
          className={field}
        />
      </label>

      <Button type="button" size="sm" className="h-9" disabled={saving} onClick={save}>
        {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
        Move draw
      </Button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="h-9 text-[11px] font-bold text-slate-500 hover:underline"
      >
        Cancel
      </button>

      <p className="w-full text-[10px] font-normal text-slate-500">
        Moves the entry cutoff with it, and updates the schedule the storefront advertises. Gulf
        time — 13:00 is 1:00 PM.
      </p>
    </div>
  );
}

function DrawsTab() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/gifts/draws");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.message || "Could not load the draws.");
      return;
    }
    setData(body);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openCurrent() {
    setBusy(true);
    try {
      // No body: the endpoint opens the draw for whatever date is scheduled.
      const res = await fetch("/api/admin/gifts/draws", { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not open the draw.");
      toast.success(body.created ? "Draw opened." : "That draw is already open.");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-sm font-semibold text-slate-500">Loading draws...</p>;

  return (
    <div className="grid gap-4">
      {/* Keyed on the saved values so a reload after saving re-seeds the form
          from the server rather than leaving the local draft in place. */}
      <ScheduleCard
        key={`${data.drawDate}-${data.drawTime}-${data.programEnabled}`}
        data={data}
        onSaved={load}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-bold text-slate-900">
            {data.openDrawId ? "The draw now accruing" : "No draw is open yet"}
          </p>
          <p className="mt-0.5 text-[11px] font-normal text-slate-500">
            {data.liveEntryCount == null
              ? "Open it to start collecting entries — or leave it to the nightly job, which opens it for you."
              : `${data.liveEntryCount} coupon${data.liveEntryCount === 1 ? "" : "s"} would enter if it closed now.`}
          </p>
          <p className="mt-0.5 text-[11px] font-normal text-slate-500">
            No draw can be closed or run before its own date.
          </p>
        </div>
        {/* Refused while the scheduled date is behind us: the draw would open
            on a date already passed and the nightly job would freeze it on its
            very next run, closing a giveaway nobody was told about. Pick the
            next date first. */}
        <Button
          type="button"
          onClick={openCurrent}
          disabled={busy || Boolean(data.openDrawId) || data.drawPassed}
          title={data.drawPassed ? "Set the next draw date first." : undefined}
          size="sm"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
          Open the draw
        </Button>
      </div>

      {data.draws.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">
          No draws yet. Open the current cycle to start collecting entries.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border bg-white shadow-sm">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Cycle</th>
                <th className="px-4 py-2.5">Draw date</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Prizes</th>
                <th className="px-4 py-2.5">Entries</th>
                <th className="px-4 py-2.5">Winners</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.draws.map((draw) => {
                const units = draw.prizes.reduce((sum, p) => sum + p.quantity, 0);
                return (
                  // Two sibling rows per draw once the editor is open, so the
                  // key lives on a Fragment rather than on the <tr>.
                  <Fragment key={draw.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono font-bold text-slate-900">{draw.cycleKey}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {formatDrawDateTime(draw.drawDate)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={draw.status} />
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {units} unit{units === 1 ? "" : "s"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {draw.status === "SCHEDULED" && draw.id === data.openDrawId
                          ? `${data.liveEntryCount ?? 0} (live)`
                          : draw.entryCount}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{draw._count.winners}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/gifts/draws/${draw.id}`}
                            className="text-xs font-bold text-emerald-800 hover:underline"
                          >
                            Manage
                          </Link>
                          {/* Offered only while the entry list is still open. On a
                              closed draw the date is a promise already kept to
                              whoever was in it, so there is nothing to press
                              rather than a button that would be refused. */}
                          {draw.status === "SCHEDULED" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setEditingId((current) => (current === draw.id ? null : draw.id))
                              }
                              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] font-bold text-slate-700 transition hover:bg-slate-50"
                            >
                              <CalendarDays className="size-3" />
                              {editingId === draw.id ? "Close" : "Edit date"}
                            </button>
                          ) : (
                            <span
                              className="text-[10px] font-semibold text-slate-400"
                              title="The entry list has closed, so the date this draw was held on is fixed."
                            >
                              Date locked
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {editingId === draw.id ? (
                      <tr>
                        <td colSpan={7} className="p-0">
                          <DrawScheduleEditor
                            draw={draw}
                            onSaved={async () => {
                              setEditingId(null);
                              await load();
                            }}
                            onCancel={() => setEditingId(null)}
                          />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Posters ────────────────────────────────────────────────────────────── */

// What each placement means, in the admin's words rather than the enum's.
const PLACEMENT_LABELS = {
  GIFTS: "Gifts page only",
  DASHBOARD: "Customer dashboard only",
  BOTH: "Both pages",
};

/** One poster row, expanding into an editor. */
function PosterRow({ poster, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: poster.title ?? "",
    imageUrl: poster.imageUrl,
    linkUrl: poster.linkUrl ?? "",
    placement: poster.placement,
    isActive: poster.isActive,
    sortOrder: poster.sortOrder,
  });
  const [saving, setSaving] = useState(false);

  async function save(patch) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/gifts/posters/${poster.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch ?? form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not update the poster.");
      toast.success("Poster saved.");
      setOpen(false);
      await onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const res = await fetch(`/api/admin/gifts/posters/${poster.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(body.message || "Could not delete the poster.");
    toast.success("Poster deleted.");
    await onDeleted();
  }

  const field =
    "min-h-10 w-full rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700";

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
        {/* A wide thumbnail rather than a square one: posters are banners, and a
            square crop of a banner shows almost none of it. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={poster.imageUrl}
          alt=""
          className="h-12 w-24 shrink-0 rounded border border-slate-200 object-cover"
        />

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900">
            {poster.title || <span className="font-normal text-slate-400">Untitled poster</span>}
            {!poster.isActive ? (
              <span className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[8px] font-black uppercase text-slate-500">
                Hidden
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 truncate text-[10px] font-normal text-slate-500">
            {PLACEMENT_LABELS[poster.placement] ?? poster.placement}
            {poster.linkUrl ? ` · links to ${poster.linkUrl}` : " · not clickable"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-[11px] font-bold text-emerald-800 hover:underline"
        >
          {open ? "Close" : "Edit"}
        </button>
        <button type="button" onClick={remove} title="Delete" className="shrink-0 text-rose-600">
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {open ? (
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ImageUrlField
              label="Poster image"
              placeholder="https://..."
              value={form.imageUrl}
              onChange={(url) => setForm({ ...form, imageUrl: url })}
              disabled={saving}
            />
          </div>

          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Description
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Win the iPhone 18"
              className={field}
            />
            <span className="text-[10px] font-normal text-slate-500">
              Read out by screen readers, and how you tell two posters apart in this list. Not shown
              on the page — the artwork carries its own words.
            </span>
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Links to
            <input
              value={form.linkUrl}
              onChange={(e) => setForm({ ...form, linkUrl: e.target.value })}
              placeholder="/products"
              className={field}
            />
            <span className="text-[10px] font-normal text-slate-500">
              Where a click goes, e.g. <span className="font-mono">/products</span>. Leave blank to
              make the poster a plain image.
            </span>
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Shown on
            <select
              value={form.placement}
              onChange={(e) => setForm({ ...form, placement: e.target.value })}
              className={field}
            >
              {GIFT_POSTER_PLACEMENTS.map((placement) => (
                <option key={placement} value={placement}>
                  {PLACEMENT_LABELS[placement] ?? placement}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Order
            <input
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: e.target.value })}
              className={field}
            />
            <span className="text-[10px] font-normal text-slate-500">
              Lowest first. The poster with the smallest number sits at the top of the page.
            </span>
          </label>

          <label className="flex items-start gap-2 text-[11px] font-semibold text-slate-700 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              Active
              <span className="block font-normal text-slate-500">
                Untick to take the poster down without deleting it — useful for artwork you will run
                again next campaign.
              </span>
            </span>
          </label>

          <div className="flex justify-end sm:col-span-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => save()}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save poster
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const BLANK_POSTER = { title: "", imageUrl: "", linkUrl: "", placement: "BOTH", isActive: true };

function PostersTab() {
  const [posters, setPosters] = useState(null);
  const [draft, setDraft] = useState(BLANK_POSTER);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/gifts/posters");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.message || "Could not load the posters.");
      return;
    }
    setPosters(body.posters);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e) {
    e.preventDefault();
    if (!draft.imageUrl.trim()) return toast.error("Upload a poster image first.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/gifts/posters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not add the poster.");
      toast.success("Poster added.");
      setDraft(BLANK_POSTER);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  const field =
    "min-h-10 w-full rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700";

  return (
    <div className="grid gap-4">
      <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-[11px] font-semibold text-sky-900">
        Posters are the gifts page. Whatever the artwork says — the prize, the minimum spend, the
        draw date and time — is what customers read, so keep it in step with the schedule on the
        Draws tab. Nothing is drawn over the image.
      </div>

      <form
        onSubmit={create}
        className="grid gap-3 rounded-md border border-border bg-white p-4 shadow-sm"
      >
        <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Add a poster</h3>

        <ImageUrlField
          label="Poster image"
          placeholder="https://..."
          value={draft.imageUrl}
          onChange={(url) => setDraft({ ...draft, imageUrl: url })}
          disabled={busy}
        />

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Description
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="Win the iPhone 18"
              className={field}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Links to
            <input
              value={draft.linkUrl}
              onChange={(e) => setDraft({ ...draft, linkUrl: e.target.value })}
              placeholder="/products"
              className={field}
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Shown on
            <select
              value={draft.placement}
              onChange={(e) => setDraft({ ...draft, placement: e.target.value })}
              className={field}
            >
              {GIFT_POSTER_PLACEMENTS.map((placement) => (
                <option key={placement} value={placement}>
                  {PLACEMENT_LABELS[placement] ?? placement}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" disabled={busy} size="sm" className="h-10">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add
          </Button>
        </div>
      </form>

      {!posters ? (
        <p className="text-sm font-semibold text-slate-500">Loading posters...</p>
      ) : posters.length === 0 ? (
        <p className="rounded-md border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">
          No posters yet. Until one is uploaded the gifts page falls back to a plain text banner.
        </p>
      ) : (
        <div className="rounded-md border border-border bg-white shadow-sm">
          {posters.map((poster) => (
            <PosterRow key={poster.id} poster={poster} onSaved={load} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Prizes ─────────────────────────────────────────────────────────────── */

const BLANK_PRIZE = { name: "", valueNote: "", images: [], isActive: true, isFeatured: false };

/** Small square thumbnail, or a muted placeholder when no image is set yet. */
function PrizeThumb({ src, alt, className = "size-10" }) {
  if (!src) {
    return (
      <span
        className={`${className} flex shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 text-slate-300`}
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
      className={`${className} shrink-0 rounded border border-slate-200 object-cover`}
    />
  );
}

/** One catalogue row, expanding into an editor. */
function PrizeRow({ prize, onSaved, onDeleted }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: prize.name,
    valueNote: prize.valueNote ?? "",
    images: (prize.images ?? []).map((image) => image.url),
    isActive: prize.isActive,
    isFeatured: prize.isFeatured,
  });
  const [saving, setSaving] = useState(false);

  const inUse = prize._count.tierItems + prize._count.drawPrizes + prize._count.winners > 0;

  async function save(patch) {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/gifts/prizes/${prize.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch ?? form),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not update the prize.");
      toast.success(`"${body.prize.name}" saved.`);
      setOpen(false);
      await onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const res = await fetch(`/api/admin/gifts/prizes/${prize.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(body.message || "Could not delete the prize.");
    toast.success(`"${prize.name}" deleted.`);
    await onDeleted();
  }

  return (
    <div className="border-b border-slate-100 last:border-0">
      <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
        <PrizeThumb src={prize.images?.[0]?.url} alt={prize.name} />

        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-xs font-bold text-slate-900">
            {prize.name}
            {prize.isFeatured ? (
              <span className="rounded border border-amber-200 bg-amber-50 px-1 py-0.5 text-[8px] font-black uppercase text-amber-800">
                Featured
              </span>
            ) : null}
            {!prize.isActive ? (
              <span className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[8px] font-black uppercase text-slate-500">
                Hidden
              </span>
            ) : null}
            {(prize.images?.length ?? 0) === 0 ? (
              <span className="rounded border border-sky-200 bg-sky-50 px-1 py-0.5 text-[8px] font-black uppercase text-sky-700">
                No image
              </span>
            ) : prize.images.length > 1 ? (
              <span className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[8px] font-black uppercase text-slate-500">
                {prize.images.length} images
              </span>
            ) : null}
          </p>
          <p className="mt-0.5 text-[10px] font-normal text-slate-500">
            {prize._count.tierItems} roadmap · {prize._count.drawPrizes} draws ·{" "}
            {prize._count.winners} wins
            {prize.valueNote ? ` · ${prize.valueNote}` : ""}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 text-[11px] font-bold text-emerald-800 hover:underline"
        >
          {open ? "Close" : "Edit"}
        </button>
        <button
          type="button"
          onClick={remove}
          disabled={inUse}
          title={
            inUse
              ? "In use by the roadmap, a draw or a recorded win. Deactivate it instead."
              : "Delete"
          }
          className="shrink-0 text-rose-600 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {open ? (
        <div className="grid gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none focus:border-emerald-700"
            />
          </label>

          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Value note
            <input
              value={form.valueNote}
              onChange={(e) => setForm({ ...form, valueNote: e.target.value })}
              placeholder="AED 5,000"
              className="min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none focus:border-emerald-700"
            />
          </label>

          <div className="sm:col-span-2">
            <ImageListField
              label="Prize images"
              value={form.images}
              onChange={(images) => setForm({ ...form, images })}
              disabled={saving}
              hint="The cover is the one customers see on cards, thumbnails and in winner emails. The rest appear as a thumbnail strip on the gifts page for featured prizes."
            />
          </div>

          <label className="flex items-start gap-2 text-[11px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.isFeatured}
              onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              Feature at the top of the gifts page
              <span className="block font-normal text-slate-500">
                For headline prizes only — the car, the villa. Featured prizes show large above
                the roadmap, so they need a good image.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-2 text-[11px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="mt-0.5"
            />
            <span>
              Active
              <span className="block font-normal text-slate-500">
                Hidden prizes stay on past draws and roadmap rows but cannot be added to new ones.
              </span>
            </span>
          </label>

          <div className="flex justify-end sm:col-span-2">
            <Button type="button" size="sm" disabled={saving} onClick={() => save()}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
              Save prize
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function PrizesTab() {
  const [prizes, setPrizes] = useState(null);
  const [draft, setDraft] = useState(BLANK_PRIZE);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/gifts/prizes");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.message || "Could not load the prizes.");
      return;
    }
    setPrizes(body.prizes);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e) {
    e.preventDefault();
    if (!draft.name.trim()) return toast.error("A prize name is required.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/gifts/prizes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not add the prize.");
      toast.success(`"${body.prize.name}" added.`);
      setDraft(BLANK_PRIZE);
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }

  const missingImages = prizes?.filter((prize) => (prize.images?.length ?? 0) === 0).length ?? 0;

  return (
    <div className="grid gap-4">
      {/* The gifts page is a shop window; without images it is a spreadsheet.
          Counted rather than merely mentioned so the admin can see the job
          shrink as they work through it. */}
      {missingImages > 0 ? (
        <div className="rounded-md border border-sky-200 bg-sky-50 p-3 text-[11px] font-semibold text-sky-900">
          {missingImages} prize{missingImages === 1 ? " has" : "s have"} no image yet. Press Edit on
          a row to upload one — prizes without an image show a plain placeholder on the gifts page.
        </div>
      ) : null}

      <form onSubmit={create} className="grid gap-3 rounded-md border border-border bg-white p-4 shadow-sm">
        <h3 className="text-xs font-black uppercase tracking-wide text-slate-500">Add a prize</h3>

        <ImageListField
          label="Prize images"
          value={draft.images}
          onChange={(images) => setDraft({ ...draft, images })}
          disabled={busy}
          hint="Optional here — you can always add or reorder them later with Edit. The first image is the cover."
        />

        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Name
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="Smart Watch"
              className="min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none focus:border-emerald-700"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-slate-800">
            Value note
            <input
              value={draft.valueNote}
              onChange={(e) => setDraft({ ...draft, valueNote: e.target.value })}
              placeholder="AED 500"
              className="min-h-10 rounded border border-input bg-white px-3 text-xs font-normal outline-none focus:border-emerald-700"
            />
          </label>
          <Button type="submit" disabled={busy} size="sm" className="h-10">
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            Add
          </Button>
        </div>
        <p className="text-[10px] font-normal text-slate-500">
          A prize added here joins the catalogue, ready to be put into a draw or a roadmap row.
        </p>
      </form>

      {!prizes ? (
        <p className="text-sm font-semibold text-slate-500">Loading prizes...</p>
      ) : (
        <div className="rounded-md border border-border bg-white shadow-sm">
          {prizes.map((prize) => (
            <PrizeRow key={prize.id} prize={prize} onSaved={load} onDeleted={load} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Roadmap ────────────────────────────────────────────────────────────── */

function RoadmapTab() {
  const [data, setData] = useState(null);
  const [savingId, setSavingId] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/gifts/tiers");
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(body.message || "Could not load the roadmap.");
      return;
    }
    setData(body);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveTier(tier, patch) {
    setSavingId(tier.id);
    try {
      const res = await fetch(`/api/admin/gifts/tiers/${tier.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not save the row.");
      toast.success("Roadmap row saved.");
      await load();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingId(null);
    }
  }

  async function addTier() {
    const res = await fetch("/api/admin/gifts/tiers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberCount: 0, items: [] }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(body.message || "Could not add the row.");
    await load();
  }

  async function removeTier(tier) {
    const res = await fetch(`/api/admin/gifts/tiers/${tier.id}`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return toast.error(body.message || "Could not delete the row.");
    await load();
  }

  if (!data) return <p className="text-sm font-semibold text-slate-500">Loading roadmap...</p>;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-white p-4 shadow-sm">
        <p className="text-[11px] font-normal text-slate-600">
          The long-term prize plan. Not currently shown on <span className="font-mono">/gifts</span>
          {" "}— that page is the posters now — but kept and editable so the table can go back up
          without retyping it. Published content either way: nothing here decides who wins anything.
        </p>
        <Button type="button" onClick={addTier} size="sm">
          <Plus className="size-3.5" />
          Add row
        </Button>
      </div>

      {data.tiers.map((tier) => (
        <TierRow
          key={tier.id}
          tier={tier}
          prizes={data.prizes}
          saving={savingId === tier.id}
          onSave={(patch) => saveTier(tier, patch)}
          onDelete={() => removeTier(tier)}
        />
      ))}
    </div>
  );
}

function TierRow({ tier, prizes, saving, onSave, onDelete }) {
  const [form, setForm] = useState({
    memberCount: tier.memberCount,
    totalMembers: tier.totalMembers ?? "",
    targetDays: tier.targetDays ?? "",
    totalValueNote: tier.totalValueNote ?? "",
    isActive: tier.isActive,
  });
  const [items, setItems] = useState(
    tier.items.map((item) => ({ prizeId: item.prizeId, quantity: item.quantity }))
  );

  const field = "min-h-9 w-full rounded border border-input bg-white px-2 text-xs font-normal text-slate-900 outline-none focus:border-emerald-700";

  return (
    <div className="rounded-md border border-border bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-5">
        <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
          Members
          <input
            type="number"
            min={0}
            value={form.memberCount}
            onChange={(e) => setForm({ ...form, memberCount: e.target.value })}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
          Total members
          <input
            type="number"
            min={0}
            value={form.totalMembers}
            onChange={(e) => setForm({ ...form, totalMembers: e.target.value })}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
          Target days
          <input
            type="number"
            min={0}
            value={form.targetDays}
            onChange={(e) => setForm({ ...form, targetDays: e.target.value })}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500 sm:col-span-2">
          Total value note
          <input
            value={form.totalValueNote}
            onChange={(e) => setForm({ ...form, totalValueNote: e.target.value })}
            placeholder="T = 50,000"
            className={field}
          />
        </label>
      </div>

      <div className="mt-3 grid gap-2">
        {items.map((item, index) => (
          <div key={index} className="flex items-center gap-2">
            <select
              value={item.prizeId}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...next[index], prizeId: e.target.value };
                setItems(next);
              }}
              className={`${field} flex-1`}
            >
              <option value="">Select a prize...</option>
              {prizes.map((prize) => (
                <option key={prize.id} value={prize.id}>
                  {prize.name}
                  {(prize.images?.length ?? 0) === 0 ? " (no image)" : ""}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={item.quantity}
              onChange={(e) => {
                const next = [...items];
                next[index] = { ...next[index], quantity: e.target.value };
                setItems(next);
              }}
              className={`${field} w-20`}
            />
            <button
              type="button"
              onClick={() => setItems(items.filter((_, i) => i !== index))}
              className="text-rose-600"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setItems([...items, { prizeId: "", quantity: 1 }])}
          className="justify-self-start text-[11px] font-bold text-emerald-800 hover:underline"
        >
          + Add prize line
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
        <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
          />
          Shown on the gifts page
        </label>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDelete} className="text-[11px] font-bold text-rose-600 hover:underline">
            Delete row
          </button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => onSave({ ...form, items: items.filter((item) => item.prizeId) })}
          >
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function AdminGiftsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState("draws");

  useEffect(() => {
    async function check() {
      const res = await fetch("/api/auth/session");
      const data = await res.json();
      if (!data.loggedIn || data.session.role !== "ADMIN") {
        toast.error("Unauthorized administrative access.");
        router.push("/login");
        return;
      }
      setAuthChecked(true);
    }
    check();
  }, [router]);

  if (!authChecked) {
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
            <Link
              href="/admin"
              className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white"
            >
              <ArrowLeft className="size-3" />
              Console Home
            </Link>
            <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-white">
              <Gift className="size-7 text-emerald-400" />
              Gifts
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              The schedule, the campaign posters, the prize catalogue and the draw itself.
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-5 flex gap-1 rounded-md border border-border bg-white p-1 shadow-sm">
          {TABS.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`flex flex-1 items-center justify-center gap-2 rounded px-3 py-2 text-xs font-bold transition ${
                  tab === item.id
                    ? "bg-emerald-50 text-emerald-800"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <Icon className="size-3.5" />
                {item.label}
              </button>
            );
          })}
        </div>

        <FadeIn>
          {tab === "draws" ? <DrawsTab /> : null}
          {tab === "posters" ? <PostersTab /> : null}
          {tab === "prizes" ? <PrizesTab /> : null}
          {tab === "roadmap" ? <RoadmapTab /> : null}
        </FadeIn>
      </section>

      <SiteFooter />
    </main>
  );
}
