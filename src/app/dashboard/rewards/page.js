"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Gift,
  PartyPopper,
  Truck,
  Users,
  Sparkles,
  ArrowRight,
  Loader2,
  MapPin,
  Trophy,
  Lock,
  ShoppingBag,
  CheckCircle2,
  Repeat,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { NextDrawProgress } from "@/components/NextDrawProgress";

const EMPTY_ADDRESS = {
  fullName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "India",
};

export default function RewardsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  // The prize currently being claimed + the address form + submit state. Gift-draw
  // wins and the milestone free product claim to different endpoints but share this
  // form, so the card carries its own claim URL.
  const [claimingId, setClaimingId] = useState(null);
  const [claimUrl, setClaimUrl] = useState(null);
  const [address, setAddress] = useState(EMPTY_ADDRESS);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    return fetch("/api/gifts/me")
      .then((r) => (r.status === 401 ? { loggedIn: false } : r.json()))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openClaim = (win) => {
    setAddress(EMPTY_ADDRESS);
    setClaimingId(win.id);
    setClaimUrl(win.claimUrl);
  };

  const submitClaim = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const toastId = toast.loading("Submitting your claim...");
    try {
      const res = await fetch(claimUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(address),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.message || "Could not submit claim.");
      toast.success(body.message || "Gift claimed!", { id: toastId });
      setClaimingId(null);
      await load();
    } catch (err) {
      toast.error(err.message || "Something went wrong.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="animate-pulse text-sm font-medium text-slate-500">Loading your rewards...</p>
      </div>
    );
  }

  const eligible = data?.eligible;

  // The milestone free product isn't drawn — it's guaranteed the moment you cross
  // your referral milestone — but it ships through the same claim-an-address flow as
  // a draw win, so it renders as one more card in the same list.
  const reward = data?.referralReward;
  const prizes = [
    ...(reward && reward.status !== "REJECTED"
      ? [
          {
            id: reward.id,
            claimUrl: "/api/gifts/referral-reward/claim",
            giftName: reward.productName,
            giftImageUrl: reward.productImageUrl,
            quantity: reward.quantity,
            status: reward.status,
            adminNote: reward.adminNote,
            addressSnapshot: reward.addressSnapshot,
            tierLabel: "Referral milestone",
            isMilestoneReward: true,
          },
        ]
      : []),
    ...(data?.wins || []).map((w) => ({
      ...w,
      claimUrl: `/api/gifts/wins/${w.id}/claim`,
    })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageReveal>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Gift className="size-6 text-emerald-700" />
          My Gift Rewards
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Refer friends who shop to enter the draws. When you win, claim your gift here.
        </p>
      </PageReveal>

      {/* Eligibility status */}
      <EligibilityCard data={data} />

      {/* When is the next draw — community progress toward the next milestone. */}
      <NextDrawProgress tone="light" />

      {/* Prizes: the milestone free product + any gift-draw wins */}
      {prizes.length > 0 ? (
        <div className="flex flex-col gap-4">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            <Trophy className="size-4 text-amber-500" /> Your rewards
          </h2>
          {prizes.map((win) => (
            <WinCard
              key={win.id}
              win={win}
              isClaiming={claimingId === win.id}
              onOpenClaim={() => openClaim(win)}
              onCancelClaim={() => setClaimingId(null)}
              address={address}
              setAddress={setAddress}
              submitting={submitting}
              onSubmit={submitClaim}
            />
          ))}
        </div>
      ) : eligible ? (
        <FadeIn className="rounded-md border border-border bg-white p-8 text-center shadow-sm">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
            <Sparkles className="size-7" />
          </span>
          <h2 className="mt-4 text-lg font-bold text-slate-900">You&apos;re in the draws!</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
            Winners are drawn at each milestone. Explore the gifts you could win.
          </p>
          <Link
            href="/gifts"
            className="mt-5 inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Explore gifts <ArrowRight className="size-4" />
          </Link>
        </FadeIn>
      ) : null}
    </div>
  );
}

function EligibilityCard({ data }) {
  if (!data || data.loggedIn === false) return null;

  const { purchased, qualifyingReferrals, threshold, eligible } = data;
  const have = Math.min(qualifyingReferrals ?? 0, threshold ?? 0);
  const pct = threshold > 0 ? Math.round((have / threshold) * 100) : 0;
  const remaining = Math.max(0, (threshold ?? 0) - (qualifyingReferrals ?? 0));

  if (eligible) {
    return (
      <FadeIn className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-5">
        <CheckCircle2 className="size-6 text-emerald-700" />
        <div>
          <p className="text-sm font-bold text-emerald-900">You&apos;re entered in the gift draws 🎉</p>
          <p className="mt-0.5 text-xs text-emerald-800">
            You&apos;ve met both requirements — every milestone draw could be yours.
          </p>
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="rounded-md border border-border bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Lock className="size-5 text-slate-500" />
        <h2 className="text-sm font-bold text-slate-900">Unlock the gift draws</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2.5 rounded-lg border border-border p-3 text-sm">
          <ShoppingBag className={`size-5 ${purchased ? "text-emerald-600" : "text-slate-500"}`} />
          <span className="font-semibold text-slate-800">
            Purchase a product {purchased ? "✓" : ""}
          </span>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
            <span className="flex items-center gap-1.5">
              <Users className="size-4 text-emerald-600" /> {have}/{threshold} referrals who shop
            </span>
            <span className="text-xs text-slate-500">{pct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {remaining > 0 ? `Refer ${remaining} more friend${remaining === 1 ? "" : "s"} who place a paid order. ` : "Make a purchase to unlock. "}
        <Link href="/dashboard/referrals" className="font-semibold text-emerald-700 hover:underline">
          Share your code →
        </Link>
      </p>
    </FadeIn>
  );
}

function WinCard({
  win,
  isClaiming,
  onOpenClaim,
  onCancelClaim,
  address,
  setAddress,
  submitting,
  onSubmit,
}) {
  const a = win.addressSnapshot || {};
  return (
    <FadeIn className="overflow-hidden rounded-md border border-border bg-white shadow-sm">
      <div className="flex items-center gap-4 bg-linear-to-br from-[#232f3e] to-[#131921] p-5 text-white">
        <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/15">
          {win.giftImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={win.giftImageUrl} alt={win.giftName} className="size-full object-cover" />
          ) : (
            <Gift className="size-8" />
          )}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-white/70">
              {win.isMilestoneReward
                ? "Referral milestone"
                : win.tierLabel
                  ? `${win.tierLabel} draw`
                  : "Gift win"}
            </p>
            {win.isMilestoneReward ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
                <Sparkles className="size-3" /> Free product
              </span>
            ) : win.isReferrerMirror ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold">
                <Repeat className="size-3" /> Referral bonus
              </span>
            ) : null}
          </div>
          <p className="truncate text-xl font-extrabold">
            {win.giftName}
            {win.quantity > 1 ? <span className="text-yellow-300"> ×{win.quantity}</span> : null}
          </p>
          {win.isMilestoneReward ? (
            <p className="mt-0.5 text-xs font-semibold text-white/75">
              Yours free for reaching your referral milestone.
            </p>
          ) : win.isReferrerMirror ? (
            <p className="mt-0.5 text-xs font-semibold text-white/75">
              You referred a winner — you get the same gift!
            </p>
          ) : null}
        </div>
      </div>

      <div className="p-5">
        {win.status === "SHIPPED" ? (
          <div className="flex items-center gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <Truck className="size-6 text-emerald-700" />
            <div>
              <p className="text-sm font-bold text-emerald-900">Your gift is on its way! 🚚</p>
              {win.adminNote ? <p className="mt-0.5 text-xs text-emerald-800">Tracking: {win.adminNote}</p> : null}
            </div>
          </div>
        ) : win.status === "CLAIMED" ? (
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <PartyPopper className="size-6 text-emerald-700" />
              <p className="text-sm font-bold text-emerald-900">Claimed! We&apos;re preparing your gift.</p>
            </div>
            {a.fullName ? (
              <p className="mt-2 pl-9 text-xs text-emerald-800">
                Shipping to: {a.fullName}, {a.line1}, {a.city}, {a.state} — {a.postalCode}
              </p>
            ) : null}
          </div>
        ) : isClaiming ? (
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-2 text-emerald-800">
              <MapPin className="size-5" />
              <h3 className="text-base font-bold">Enter your shipping address</h3>
            </div>
            <Field label="Full name *" value={address.fullName} onChange={(v) => setAddress({ ...address, fullName: v })} disabled={submitting} />
            <Field label="Phone *" value={address.phone} onChange={(v) => setAddress({ ...address, phone: v })} disabled={submitting} />
            <Field label="Address line 1 *" className="sm:col-span-2" value={address.line1} onChange={(v) => setAddress({ ...address, line1: v })} disabled={submitting} />
            <Field label="Address line 2" className="sm:col-span-2" value={address.line2} onChange={(v) => setAddress({ ...address, line2: v })} disabled={submitting} />
            <Field label="City *" value={address.city} onChange={(v) => setAddress({ ...address, city: v })} disabled={submitting} />
            <Field label="State *" value={address.state} onChange={(v) => setAddress({ ...address, state: v })} disabled={submitting} />
            <Field label="PIN code *" value={address.postalCode} onChange={(v) => setAddress({ ...address, postalCode: v })} disabled={submitting} />
            <Field label="Country" value={address.country} onChange={(v) => setAddress({ ...address, country: v })} disabled={submitting} />
            <div className="sm:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                {submitting ? "Submitting..." : "Claim my gift"}
              </button>
              <button
                type="button"
                onClick={onCancelClaim}
                disabled={submitting}
                className="inline-flex h-11 items-center justify-center rounded-md border border-border px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">
              Congratulations! Enter a shipping address to receive your gift.
            </p>
            <button
              onClick={onOpenClaim}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              Claim my gift <ArrowRight className="size-4" />
            </button>
          </div>
        )}
      </div>
    </FadeIn>
  );
}

function Field({ label, value, onChange, disabled, className = "" }) {
  return (
    <label className={`grid gap-1.5 text-xs font-semibold text-slate-800 ${className}`}>
      {label}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full min-h-10 rounded border border-input bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-emerald-700"
      />
    </label>
  );
}
