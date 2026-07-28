"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail, Search, TriangleAlert } from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

const STATUS_STYLES = {
  SENT: "bg-emerald-50 text-emerald-800 border-emerald-200",
  FAILED: "bg-rose-50 text-rose-800 border-rose-200",
  SKIPPED: "bg-slate-100 text-slate-600 border-slate-200",
};

const FILTERS = ["ALL", "SENT", "FAILED", "SKIPPED"];

function formatWhen(value) {
  const d = new Date(value);
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

/**
 * Transactional email audit trail.
 *
 * Every send attempt is recorded by lib/email.js, so this page answers "did the
 * customer actually get it?" — and, more importantly, surfaces a run of
 * failures, which means the provider is rejecting sends and password-reset
 * codes are quietly not arriving either.
 */
export default function AdminEmailsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [logs, setLogs] = useState([]);
  const [failedLast24h, setFailedLast24h] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");

  // Declared before the effect that calls it — a `const` arrow function is in
  // the temporal dead zone until this line runs, so hoisting the effect above
  // it would read a stale binding.
  const fetchLogs = async (nextStatus, search) => {
    try {
      const params = new URLSearchParams();
      if (nextStatus && nextStatus !== "ALL") params.set("status", nextStatus);
      if (search) params.set("search", search);

      const res = await fetch(`/api/admin/emails?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Failed to load the email log.");
        return;
      }
      setLogs(data.logs ?? []);
      setFailedLast24h(data.failedLast24h ?? 0);
    } catch (e) {
      toast.error("Failed to load the email log.");
    }
  };

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
        await fetchLogs("ALL", "");
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }
    initPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilter = async (nextStatus) => {
    setStatus(nextStatus);
    setLoading(true);
    await fetchLogs(nextStatus, query);
    setLoading(false);
  };

  const applySearch = async (e) => {
    e.preventDefault();
    setLoading(true);
    await fetchLogs(status, query);
    setLoading(false);
  };

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-slate-50">
        <SiteHeader />
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="size-6 animate-spin text-emerald-700" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <SiteHeader />
      <PageReveal>
        <section className="mx-auto w-full max-w-6xl px-4 py-8">
          <FadeIn>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 transition hover:text-emerald-700"
            >
              <ArrowLeft className="size-3.5" />
              Back to admin
            </Link>

            <div className="mt-3 flex items-center gap-2">
              <Mail className="size-5 text-emerald-700" />
              <h1 className="text-xl font-bold text-slate-900">Email log</h1>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Every transactional email the store has tried to send, newest first.
            </p>
          </FadeIn>

          {failedLast24h > 0 ? (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-rose-700" />
              <p className="text-xs text-rose-800">
                <strong>{failedLast24h}</strong>{" "}
                {failedLast24h === 1 ? "email has" : "emails have"} failed to send in the
                last 24 hours. Password-reset codes go through the same provider, so
                customers may be unable to log in. Check the provider dashboard and the
                daily sending limit.
              </p>
            </div>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => applyFilter(f)}
                className={`rounded-full border px-3 py-1 text-[11px] font-bold transition ${
                  status === f
                    ? "border-emerald-700 bg-emerald-700 text-white"
                    : "border-slate-300 bg-white text-slate-600 hover:border-emerald-600"
                }`}
              >
                {f}
              </button>
            ))}

            <form onSubmit={applySearch} className="ml-auto flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Recipient, subject or template"
                  className="w-64 rounded-md border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-800 outline-none focus:border-emerald-600"
                />
              </div>
              <button
                type="submit"
                className="rounded-md border border-emerald-700 px-3 py-1.5 text-[11px] font-bold text-emerald-800 transition hover:bg-emerald-50"
              >
                Search
              </button>
            </form>
          </div>

          {loading ? (
            <div className="flex min-h-[30vh] items-center justify-center">
              <Loader2 className="size-6 animate-spin text-emerald-700" />
            </div>
          ) : logs.length === 0 ? (
            <p className="mt-8 rounded-lg border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              No emails match this filter yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full min-w-[820px] text-left">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">When</th>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Recipient</th>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Subject</th>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Template</th>
                    <th className="p-3 text-[10px] font-bold uppercase tracking-wide text-slate-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-slate-100 last:border-0">
                      <td className="whitespace-nowrap p-3 text-[11px] text-slate-500">
                        {formatWhen(log.createdAt)}
                      </td>
                      <td className="p-3 text-xs text-slate-800">{log.recipient}</td>
                      <td className="max-w-[260px] truncate p-3 text-xs text-slate-800">
                        {log.subject}
                      </td>
                      <td className="p-3">
                        <span className="font-mono text-[10px] text-slate-500">{log.template}</span>
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex rounded border px-2 py-0.5 text-[9px] font-bold ${
                            STATUS_STYLES[log.status] || STATUS_STYLES.SKIPPED
                          }`}
                        >
                          {log.status}
                        </span>
                        {log.error ? (
                          <p className="mt-1 max-w-[220px] text-[10px] leading-snug text-rose-700">
                            {log.error}
                          </p>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </PageReveal>
      <SiteFooter />
    </main>
  );
}
