"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Users,
  Gift,
  TrendingUp,
  ShoppingBag,
  Copy,
  Share2,
  Link2,
  Sparkles,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";

export default function ReferralsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shareUrl, setShareUrl] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/user/referrals");
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.message || "Failed to load referrals.");
      setData(body);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (data?.referralCode && typeof window !== "undefined") {
      setShareUrl(`${window.location.origin}/register?ref=${data.referralCode}`);
    }
  }, [data?.referralCode]);

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied!`);
    } catch {
      toast.error("Failed to copy. Please copy manually.");
    }
  };

  const share = async () => {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Join Ayursanthi",
          text: "Sign up using my referral code and discover authentic Ayurvedic wellness.",
          url: shareUrl,
        });
      } catch {
        // user cancelled — silent
      }
    } else {
      copy(shareUrl, "Referral link");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="animate-pulse text-sm font-medium text-white">Loading referrals...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 min-h-80 rounded-md border border-rose-200 bg-white p-10 text-center shadow-sm">
        <span className="flex size-12 items-center justify-center rounded-full bg-rose-100 text-rose-700">
          <AlertTriangle className="size-6" />
        </span>
        <div>
          <h2 className="text-base font-bold text-[#0f1111]">Unable to load referrals</h2>
          <p className="mt-1 text-sm text-[#3f4545]">
            {error || "Could not fetch your referrals. Please try again."}
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 rounded-md bg-[#232f3e] px-4 py-2 text-xs font-bold text-white transition hover:bg-[#131921]"
        >
          <RefreshCw className="size-3.5" />
          Retry
        </button>
      </div>
    );
  }

  const { referralCode, referralsCount, totalCommissionEarned, totalPurchasesGenerated, referees } = data;

  return (
    <div className="flex flex-col gap-6">
      <PageReveal>
        <h1 className="text-2xl font-bold text-white">My Referrals</h1>
        <p className="mt-1 text-sm text-[#3f4545]">
          Share your code, grow your network, and earn 10% commission on every purchase your referrals make.
        </p>
      </PageReveal>

      {/* Your code card */}
      <FadeIn className="rounded-md border-2 border-[#d5d9d9] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-md bg-[#232f3e] text-white">
            <Sparkles className="size-4" />
          </span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#0f1111]">
            Your Referral Code
          </h2>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex items-center gap-2 rounded-md border-2 border-dashed border-[#d5d9d9] bg-[#f8fafc] px-4 py-3">
            <code className="font-mono text-2xl font-extrabold tracking-widest text-[#0f1111]">
              {referralCode || "—"}
            </code>
            {referralCode && (
              <button
                onClick={() => copy(referralCode, "Referral code")}
                className="ml-2 inline-flex items-center gap-1 rounded-md bg-[#232f3e] px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#131921]"
                aria-label="Copy referral code"
              >
                <Copy className="size-3" />
                Copy
              </button>
            )}
          </div>

          <p className="text-xs leading-6 text-[#3f4545]">
            Share this code with friends. When they sign up and make their first purchase,
            you&apos;ll earn <span className="font-bold text-[#0f1111]">10% of every order subtotal</span> directly to your wallet.
          </p>
        </div>

        {shareUrl && (
          <div className="mt-5 grid gap-2 border-t border-[#d5d9d9] pt-4 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <Link2 className="size-4 shrink-0 text-[#0f1111]" />
              <span className="truncate text-xs font-medium text-[#0f1111]">{shareUrl}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => copy(shareUrl, "Referral link")}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#d5d9d9] bg-white px-3 py-1.5 text-[11px] font-bold text-[#0f1111] hover:bg-[#f8fafc] transition"
              >
                <Copy className="size-3" />
                Copy link
              </button>
              <button
                onClick={share}
                className="inline-flex items-center gap-1.5 rounded-md bg-[#232f3e] px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-[#131921] transition"
              >
                <Share2 className="size-3" />
                Share
              </button>
            </div>
          </div>
        )}
      </FadeIn>

      {/* Stats */}
      <Stagger className="grid gap-4 sm:grid-cols-3">
        <StaggerItem>
          <div className="flex items-center justify-between rounded-md border border-border bg-white p-5 shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">Total Referrals</p>
              <p className="mt-2 text-xl font-extrabold text-[#0f1111]">{referralsCount}</p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#232f3e] text-white">
              <Users className="size-5" />
            </span>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex items-center justify-between rounded-md border border-border bg-white p-5 shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">Commission Earned</p>
              <p className="mt-2 text-xl font-extrabold text-[#0f1111]">
                Rs. {Number(totalCommissionEarned).toLocaleString()}
              </p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#232f3e] text-white">
              <Gift className="size-5" />
            </span>
          </div>
        </StaggerItem>

        <StaggerItem>
          <div className="flex items-center justify-between rounded-md border border-border bg-white p-5 shadow-sm">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">Network Purchases</p>
              <p className="mt-2 text-xl font-extrabold text-[#0f1111]">
                Rs. {Number(totalPurchasesGenerated).toLocaleString()}
              </p>
            </div>
            <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-[#232f3e] text-white">
              <TrendingUp className="size-5" />
            </span>
          </div>
        </StaggerItem>
      </Stagger>

      {/* Referees list */}
      <FadeIn className="rounded-md border border-border bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-[#d5d9d9] p-5 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-[#0f1111]">
            <Users className="size-4 text-[#0f1111]" />
            People You Referred
            <span className="ml-1 rounded bg-[#232f3e] px-1.5 py-0.5 text-[10px] font-bold text-white">
              {referralsCount}
            </span>
          </h2>
        </div>

        {referees.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto size-12 text-[#aab7b8]" />
            <h3 className="mt-4 text-sm font-bold text-[#0f1111]">No referrals yet</h3>
            <p className="mt-1 text-xs text-[#565959] max-w-sm mx-auto">
              When someone signs up using your code, they&apos;ll appear here. Share the link above to get started.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#d5d9d9] bg-[#f8fafc]">
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                      User
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                      Joined
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                      Orders
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                      Their Purchases
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#565959]">
                      You Earned
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d5d9d9]">
                  {referees.map((r) => (
                    <tr key={r.id} className="hover:bg-[#f8fafc] transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-white text-xs font-extrabold">
                            {r.name?.charAt(0)?.toUpperCase() ?? "?"}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-[#0f1111] truncate">{r.name}</p>
                            <p className="mt-0.5 text-[10px] text-[#565959] truncate">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs text-[#3f4545]">
                        {new Date(r.joinedAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-[#0f1111]">
                          <ShoppingBag className="size-3" />
                          {r.ordersCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right text-xs font-semibold text-[#0f1111]">
                        Rs. {Number(r.totalPurchases).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 text-right text-sm font-extrabold text-[#0f1111]">
                        Rs. {Number(r.commissionEarned).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-[#d5d9d9]">
              {referees.map((r) => (
                <div key={r.id} className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-white text-sm font-extrabold">
                      {r.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#0f1111] truncate">{r.name}</p>
                      <p className="text-[11px] text-[#565959] truncate">{r.email}</p>
                      <p className="mt-0.5 text-[10px] text-[#565959]">
                        Joined{" "}
                        {new Date(r.joinedAt).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-md border border-[#d5d9d9] bg-[#f8fafc] p-3 text-center">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#565959]">Orders</p>
                      <p className="mt-0.5 text-sm font-extrabold text-[#0f1111]">{r.ordersCount}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#565959]">Spent</p>
                      <p className="mt-0.5 text-sm font-extrabold text-[#0f1111]">
                        Rs. {Number(r.totalPurchases).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-wide text-[#565959]">Earned</p>
                      <p className="mt-0.5 text-sm font-extrabold text-[#0f1111]">
                        Rs. {Number(r.commissionEarned).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </FadeIn>

      {/* How it works */}
      <FadeIn className="rounded-md border border-border bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-sm font-bold text-[#0f1111]">How it works</h3>
        <ol className="mt-3 grid gap-3 text-xs leading-6 text-[#3f4545] sm:grid-cols-3">
          <li className="flex gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-[10px] font-extrabold text-white">1</span>
            Share your code or referral link with friends and family.
          </li>
          <li className="flex gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-[10px] font-extrabold text-white">2</span>
            They enter your code during sign-up at <Link href="/register" className="font-bold text-[#0f1111] hover:underline">/register</Link>.
          </li>
          <li className="flex gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#232f3e] text-[10px] font-extrabold text-white">3</span>
            You earn 10% of every order they place — credited instantly to your <Link href="/dashboard/wallet" className="font-bold text-[#0f1111] hover:underline">wallet</Link>.
          </li>
        </ol>
      </FadeIn>
    </div>
  );
}
