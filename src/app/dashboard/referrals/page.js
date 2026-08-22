"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Copy,
  Link2,
  RefreshCw,
  Share2,
  ShoppingBag,
  Users,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";

/** Human date for a join timestamp, in the store's locale. */
function formatJoinDate(value) {
  return new Date(value).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function ReferralsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Which of the two copy buttons last succeeded, so a tick can replace its
  // icon briefly. Null when neither is in that state.
  const [copied, setCopied] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/referrals");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to load your referrals.");
      setData(body);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const referralCode = data?.referralCode || "";
  // Derived at render rather than stored: only the browser knows the public
  // origin (the same page is served from localhost, from previews and from the
  // live domain), and the guard is safe because the code is not there to build
  // a link from until the client-side fetch above has resolved anyway.
  const shareUrl =
    referralCode && typeof window !== "undefined"
      ? `${window.location.origin}/register?ref=${referralCode}`
      : "";

  const copy = async (text, key, label) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 2000);
      toast.success(`${label} copied.`);
    } catch {
      toast.error("Could not copy automatically — please select and copy it manually.");
    }
  };

  const share = async () => {
    if (!shareUrl) return;
    // navigator.share is mobile-mostly; falling back to a copy keeps the button
    // useful on desktop instead of dead.
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Ayursanthi",
          text: `Sign up with my affiliate ID ${referralCode} and discover authentic Ayurvedic wellness.`,
          url: shareUrl,
        });
      } catch {
        // Share sheet dismissed — not an error.
      }
      return;
    }
    copy(shareUrl, "link", "Invite link");
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <p className="animate-pulse text-sm font-medium text-[#0f1111]">
          Loading your referrals...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-80 flex-col items-center justify-center gap-4 rounded-md border border-rose-200 bg-rose-50 p-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <AlertTriangle className="size-6" />
        </span>
        <div>
          <h2 className="text-base font-bold text-rose-900">Unable to load your referrals</h2>
          <p className="mt-1 text-sm text-rose-700">
            {error || "Could not fetch your data. Please try again."}
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded bg-rose-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-rose-800"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const { referralsCount, referrals } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageReveal>
        <h1 className="text-[28px] font-bold leading-none text-[#0f1111]">My Referrals</h1>
        <p className="mt-2 text-[13px] leading-5 text-[#565959]">
          Share your affiliate ID. Anyone who enters it while creating their account is
          added to your referrals below.
        </p>
      </PageReveal>

      {/* Affiliate ID + invite link */}
      <FadeIn className="rounded-lg border border-[#d5d9d9] bg-white p-5 shadow-sm">
        <h2 className="text-[15px] font-bold text-[#0f1111]">Your affiliate ID</h2>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <code className="rounded-md border-2 border-dashed border-[#d5d9d9] bg-[#f7fafa] px-4 py-3 font-mono text-2xl font-extrabold tracking-[0.2em] text-[#0f1111]">
            {referralCode || "—"}
          </code>
          <button
            type="button"
            onClick={() => copy(referralCode, "code", "Affiliate ID")}
            disabled={!referralCode}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs font-bold text-[#0f1111] shadow-sm transition hover:bg-[#f7fafa] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copied === "code" ? (
              <Check className="size-3.5 text-emerald-700" />
            ) : (
              <Copy className="size-3.5" />
            )}
            {copied === "code" ? "Copied" : "Copy ID"}
          </button>
        </div>

        <div className="mt-4 border-t border-[#d5d9d9] pt-4">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#0f1111]">
            <Link2 className="size-3.5" />
            Invite link
          </p>
          <p className="mt-1 text-[12px] leading-5 text-[#565959]">
            Opens the sign-up page with your ID already filled in.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 truncate rounded-md border border-[#d5d9d9] bg-[#f7fafa] px-3 py-2 font-mono text-[12px] text-[#565959]">
              {shareUrl || "—"}
            </span>
            <button
              type="button"
              onClick={() => copy(shareUrl, "link", "Invite link")}
              disabled={!shareUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#d5d9d9] bg-white px-3 py-2 text-xs font-bold text-[#0f1111] shadow-sm transition hover:bg-[#f7fafa] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied === "link" ? (
                <Check className="size-3.5 text-emerald-700" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied === "link" ? "Copied" : "Copy link"}
            </button>
            <button
              type="button"
              onClick={share}
              disabled={!shareUrl}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#FCD200] bg-[#FFD814] px-3 py-2 text-xs font-bold text-[#0F1111] shadow-sm transition hover:bg-[#F7CA00] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Share2 className="size-3.5" />
              Share
            </button>
          </div>
        </div>
      </FadeIn>

      {/* The people who signed up with it */}
      <FadeIn className="rounded-lg border border-[#d5d9d9] bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#d5d9d9] pb-3">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-[#0f1111]">
            <Users className="size-4" />
            People you referred
          </h2>
          <span className="rounded bg-[#f0f2f2] px-2 py-1 text-[11px] font-bold text-[#0f1111]">
            {referralsCount} total
          </span>
        </div>

        {referralsCount === 0 ? (
          <div className="py-8 text-center">
            <Users className="mx-auto size-10 text-[#aab7b8]" />
            <p className="mt-3 text-[13px] font-semibold text-[#0f1111]">No referrals yet</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] leading-5 text-[#565959]">
              Send your affiliate ID to a friend. Once they enter it while creating their
              account, they will appear here.{" "}
              <Link
                href="/products"
                className="font-semibold text-[#007185] hover:text-[#c7511f] hover:underline"
              >
                Keep shopping
              </Link>
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[#d5d9d9]">
            {referrals.map((referral) => (
              <li key={referral.id} className="flex items-center justify-between gap-3 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-800">
                    {referral.name?.charAt(0)?.toUpperCase() || "U"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold text-[#0f1111]">
                      {referral.name}
                    </p>
                    <p className="truncate text-[11px] text-[#565959]">{referral.maskedEmail}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-[#565959]">
                    Joined {formatJoinDate(referral.joinedAt)}
                  </p>
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#0f1111]">
                    <ShoppingBag className="size-3" />
                    {referral.ordersCount} {referral.ordersCount === 1 ? "order" : "orders"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </FadeIn>
    </div>
  );
}
