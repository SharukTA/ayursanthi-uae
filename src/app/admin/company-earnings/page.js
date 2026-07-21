"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PiggyBank,
  ArrowLeft,
  Loader2,
  TrendingUp,
  Trophy,
  Info,
} from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const rupees = (n) => `Rs. ${Number(n || 0).toLocaleString("en-IN")}`;

export default function AdminCompanyEarningsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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
        const res = await fetch("/api/admin/company-earnings");
        setData(await res.json());
      } catch (e) {
        console.error("Initial load failure:", e);
        toast.error("Failed to load company earnings.");
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  if (!authChecked || loading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-emerald-700" />
      </main>
    );
  }

  const earnings = data?.earnings || [];
  const topReferrers = data?.topReferrers || [];

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="bg-slate-950 py-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs font-bold text-white/70 hover:text-white"
          >
            <ArrowLeft className="size-3.5" /> Back to Console
          </Link>
          <PageReveal>
            <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold tracking-tight text-white">
              <PiggyBank className="size-7" /> Company Earnings
            </h1>
            <p className="mt-1 text-sm text-white/70">
              Referral commission retained before customers reach their
              milestone — revenue kept rather than paid out.
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        {/* What this is */}
        <FadeIn className="mb-6 flex items-start gap-3 rounded-md border border-sky-200 bg-sky-50 p-4 text-sky-900">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p className="text-[11px] leading-5">
            This is a <strong>ledger, not a separate balance</strong>. Every
            customer payment already lands in your Razorpay account; retaining
            commission just means it was never credited out to the referrer.
            Read it as “referral payouts avoided,” and reconcile against your
            Razorpay settlements.
          </p>
        </FadeIn>

        {/* Stat tiles */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-md border border-emerald-200 bg-white p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-450">
                Total Retained
              </p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">
                {rupees(data?.totalRetained)}
              </p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-md bg-emerald-100/55 text-emerald-700">
              <PiggyBank className="size-6" />
            </span>
          </div>
          <div className="rounded-md border border-indigo-250 bg-white p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-450">
                Ledger Entries
              </p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">
                {Number(data?.count || 0).toLocaleString("en-IN")}
              </p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-md bg-indigo-100/55 text-indigo-750">
              <TrendingUp className="size-6" />
            </span>
          </div>
          <div className="rounded-md border border-amber-250 bg-white p-6 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-450">
                Referrers Contributing
              </p>
              <p className="mt-2 text-2xl font-extrabold text-slate-950">
                {topReferrers.length.toLocaleString("en-IN")}
                <span className="text-sm font-bold text-slate-400">
                  {" "}
                  (top 10)
                </span>
              </p>
            </div>
            <span className="flex size-12 items-center justify-center rounded-md bg-amber-100/55 text-amber-800">
              <Trophy className="size-6" />
            </span>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          {/* Ledger */}
          <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-4 text-base font-bold text-slate-950">
              Retained Commission Ledger
            </h2>
            {earnings.length === 0 ? (
              <p className="py-10 text-center text-sm italic text-slate-500">
                No retained commission yet. Entries appear as referred customers
                place paid orders.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-450">
                    <tr>
                      <th className="py-3 pr-4">Referrer</th>
                      <th className="py-3 pr-4">From Buyer</th>
                      <th className="py-3 pr-4">Order</th>
                      <th className="py-3 pr-4">Amount</th>
                      <th className="py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {earnings.map((e) => (
                      <tr key={e.id} className="hover:bg-slate-50/50">
                        <td className="py-3 pr-4">
                          {e.referrer ? (
                            <>
                              <p className="font-bold text-slate-900">
                                {e.referrer.name}
                                {e.referrer.referralMilestoneAt && (
                                  <span className="ml-1 text-[9px] font-bold text-emerald-700">
                                    ✓ past milestone
                                  </span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {e.referrer.email}
                              </p>
                            </>
                          ) : (
                            <span className="italic text-slate-400">
                              (deleted)
                            </span>
                          )}
                        </td>
                        <td className="py-3 pr-4">{e.buyerName || "—"}</td>
                        <td className="py-3 pr-4 font-mono text-[10px] font-bold text-emerald-800">
                          {e.orderNumber || "—"}
                        </td>
                        <td className="py-3 pr-4 font-extrabold text-slate-900">
                          {rupees(e.amount)}
                        </td>
                        <td className="py-3 text-[10px] text-slate-450">
                          {new Date(e.createdAt).toLocaleDateString("en-IN", {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FadeIn>

          {/* Top referrers */}
          <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
            <h2 className="border-b border-slate-100 pb-4 text-base font-bold text-slate-950 flex items-center gap-2">
              <Trophy className="size-5 text-amber-600" /> Top Contributors
            </h2>
            <p className="mt-2 text-[11px] leading-5 text-slate-500">
              Customers generating the most retained commission — the ones
              closest to (or newly past) their milestone.
            </p>
            {topReferrers.length === 0 ? (
              <p className="py-8 text-center text-sm italic text-slate-500">
                No data yet.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {topReferrers.map((t, i) => (
                  <li
                    key={t.referrer?.id || i}
                    className="flex items-center justify-between rounded-md border border-border p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                        {i + 1}
                      </span>
                      <div>
                        <p className="text-sm font-bold text-slate-900">
                          {t.referrer?.name || "(deleted)"}
                          {t.referrer?.referralMilestoneAt && (
                            <span className="ml-1 text-[9px] font-bold text-emerald-700">
                              ✓
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {t.orders} order{t.orders === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-slate-900">
                      {rupees(t.total)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </FadeIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
