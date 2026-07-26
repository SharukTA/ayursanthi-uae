"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo3D } from "@/components/Logo3D";

export default function LoginPage() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      toast.error("Please enter both your Login ID and password.");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Logging you in...");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Invalid login credentials.");
      }

      toast.success("Welcome back!", { id: toastId });
      window.dispatchEvent(new Event("authUpdate"));

      // Return the user to whatever page bounced them here (proxy.js adds
      // `?next=`). Only same-site paths are accepted — taking an arbitrary
      // value would turn login into an open redirect to any external URL.
      const next = new URLSearchParams(window.location.search).get("next");
      const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
      router.push(safeNext || (data.user?.role === "ADMIN" ? "/admin" : "/"));
      router.refresh();
    } catch (error) {
      toast.error(error.message || "Something went wrong. Please try again.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50 text-slate-900"
      style={{ fontFamily: '"Amazon Ember", Arial, sans-serif' }}
    >
      {/* Minimal navbar — Ayursanthi logo only, left-aligned. Keeps the brand teal bar. */}
      <header className="border-b border-white/10 bg-[#232f3e]">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-2 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Ayursanthi home">
            <Logo3D size={72} />
          </Link>
        </div>
      </header>

      {/* Simple sign-in form — heading, 2 labelled fields + login button */}
      <main className="flex flex-1 items-center justify-center px-4 py-6 sm:py-10">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Sign in or create account</h1>

          <label className="mt-6 grid gap-2 text-sm font-semibold text-slate-900">
            Enter mobile number or email
            <input
              type="text"
              name="identifier"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              disabled={loading}
              required
              className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-normal text-slate-900 outline-none transition focus:border-[#007185] focus:ring-4 focus:ring-[#007185]/25 disabled:opacity-60"
            />
          </label>

          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-900">
            Enter password
            <input
              type="password"
              name="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
              className="min-h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-normal text-slate-900 outline-none transition focus:border-[#007185] focus:ring-4 focus:ring-[#007185]/25 disabled:opacity-60"
            />
          </label>

          <div className="mt-2 text-right">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[#007185] hover:text-[#c7511f] hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#FCD200] bg-[#FFD814] text-[13px] font-medium text-[#0F1111] shadow-[0_2px_5px_0_rgba(213,217,217,0.5)] transition hover:bg-[#F7CA00] active:bg-[#F0B800] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Logging in...
              </>
            ) : (
              "Login"
            )}
          </button>

          <div className="mt-6 flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-200" />
            New here?
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <Link
            href="/register"
            className="mt-4 flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-linear-to-b from-white to-slate-100 text-[13px] font-medium text-slate-900 shadow-[0_2px_5px_0_rgba(213,217,217,0.5)] transition hover:from-slate-50 hover:to-slate-200"
          >
            Create account
          </Link>
        </form>
      </main>

      {/* Footer — bottom bar only (no Shop/Support columns) */}
      <footer className="border-t border-white/10 bg-linear-to-b from-[#0c403f] to-[#06201f]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-sm text-white">
            Already a customer?{" "}
            <Link href="/login" className="font-medium text-white hover:underline">
              Sign in
            </Link>
          </p>
          <p className="text-xs text-white">
            &copy; 2026 Ayursanthi Wellness. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
