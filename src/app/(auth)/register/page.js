"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Logo3D } from "@/components/Logo3D";
import { PasswordField } from "@/components/PasswordField";
import { PhoneField } from "@/components/PhoneField";
import {
  validateRegistration,
  validateReferralCode,
  normalizeReferralCode,
  REFERRAL_CODE_MAX_LENGTH,
} from "@/lib/validation";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  // Affiliate ID of the customer who referred them. Optional, and offered only
  // here — the inline signup inside checkout deliberately leaves it out so a
  // purchase in progress is never held up by a code someone has to go and find.
  const [referralCode, setReferralCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Prefill from a shared link (/register?ref=SHAR7K2D), which is what the
  // "Copy link" button on /dashboard/referrals hands out. Read from the URL in
  // an effect rather than with useSearchParams: this page is one big client
  // component, so that hook would force the whole route out of prerendering.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReferralCode(normalizeReferralCode(ref));
  }, []);

  // Clear a field's error as soon as the user edits it.
  const clearError = (field) =>
    setErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const handleRegister = async (e) => {
    e.preventDefault();

    const fieldErrors = validateRegistration({ name, email, phone, password });
    // Shape only. Whether the ID belongs to a real account is decided by the
    // server, which is the only side that can look it up.
    const referralError = validateReferralCode(referralCode);
    if (referralError) fieldErrors.referralCode = referralError;
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      toast.error(Object.values(fieldErrors)[0]);
      return;
    }
    setErrors({});

    setLoading(true);
    const toastId = toast.loading("Creating your account...");

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          referralCode: normalizeReferralCode(referralCode),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Surface field-level errors from the server (validation, duplicate
        // email/phone) next to the relevant input where available.
        if (data.errors && typeof data.errors === "object") {
          setErrors(data.errors);
        }
        throw new Error(data.message || "Failed to create account.");
      }

      toast.success("Account created successfully! Welcome to Ayursanthi.", {
        id: toastId,
        description: data.welcomeEmailSent
          ? `A welcome letter is on its way to ${email.trim()}.`
          : undefined,
        duration: 6000,
      });
      window.dispatchEvent(new Event("authUpdate"));
      router.push("/");
      router.refresh();
    } catch (error) {
      toast.error(error.message || "Something went wrong during registration.", { id: toastId });
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

      {/* Simple registration form — heading, labelled fields + create-account button */}
      <main className="flex flex-1 items-center justify-center px-4 py-6 sm:py-10">
        <form
          onSubmit={handleRegister}
          className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Create account</h1>

          <label className="mt-6 grid gap-2 text-sm font-semibold text-slate-900">
            <span>Your name <span className="text-red-600">*</span></span>
            <input
              type="text"
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                clearError("name");
              }}
              disabled={loading}
              required
              aria-invalid={errors.name ? "true" : undefined}
              placeholder="First and last name"
              className={`min-h-12 w-full rounded-md border bg-white px-4 text-sm font-normal text-slate-900 outline-none transition focus:ring-4 disabled:opacity-60 ${
                errors.name
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
                  : "border-slate-300 focus:border-[#007185] focus:ring-[#007185]/25"
              }`}
            />
            {errors.name && <span className="text-xs font-normal text-red-600">{errors.name}</span>}
          </label>

          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-900">
            <span>Email <span className="text-red-600">*</span></span>
            <input
              type="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearError("email");
              }}
              disabled={loading}
              required
              aria-invalid={errors.email ? "true" : undefined}
              placeholder="you@example.com"
              className={`min-h-12 w-full rounded-md border bg-white px-4 text-sm font-normal text-slate-900 outline-none transition focus:ring-4 disabled:opacity-60 ${
                errors.email
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
                  : "border-slate-300 focus:border-[#007185] focus:ring-[#007185]/25"
              }`}
            />
            {errors.email && <span className="text-xs font-normal text-red-600">{errors.email}</span>}
          </label>

          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-900">
            <span>Mobile number <span className="text-red-600">*</span></span>
            <PhoneField
              name="phone"
              value={phone}
              onChange={(v) => {
                setPhone(v);
                clearError("phone");
              }}
              disabled={loading}
              required
              error={!!errors.phone}
              defaultCountry="AE"
              placeholder="Mobile number"
              className="min-h-12 w-full bg-white font-normal text-slate-900 transition focus-within:border-[#007185] focus-within:ring-4 focus-within:ring-[#007185]/25"
              inputClassName="px-3 text-sm"
            />
            {errors.phone && <span className="text-xs font-normal text-red-600">{errors.phone}</span>}
          </label>

          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-900">
            <span>Password <span className="text-red-600">*</span></span>
            <PasswordField
              name="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                clearError("password");
              }}
              disabled={loading}
              required
              autoComplete="new-password"
              aria-invalid={errors.password ? "true" : undefined}
              placeholder="At least 8 characters, with a letter and number"
              className={`min-h-12 w-full rounded-md border bg-white px-4 text-sm font-normal text-slate-900 outline-none transition focus:ring-4 disabled:opacity-60 ${
                errors.password
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
                  : "border-slate-300 focus:border-[#007185] focus:ring-[#007185]/25"
              }`}
              buttonClassName="text-slate-500 hover:text-slate-900"
            />
            {errors.password && (
              <span className="text-xs font-normal text-red-600">{errors.password}</span>
            )}
          </label>

          <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-900">
            <span>
              Affiliate ID{" "}
              <span className="font-normal text-slate-500">(optional)</span>
            </span>
            <input
              type="text"
              name="referralCode"
              value={referralCode}
              onChange={(e) => {
                // Normalise as they type, so what they see is exactly
                // what gets looked up.
                setReferralCode(normalizeReferralCode(e.target.value));
                clearError("referralCode");
              }}
              disabled={loading}
              maxLength={REFERRAL_CODE_MAX_LENGTH}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={errors.referralCode ? "true" : undefined}
              aria-describedby="referral-code-hint"
              placeholder="e.g. SHAR7K2D"
              className={`min-h-12 w-full rounded-md border bg-white px-4 font-mono text-sm font-normal uppercase tracking-widest text-slate-900 outline-none transition focus:ring-4 disabled:opacity-60 ${
                errors.referralCode
                  ? "border-red-500 focus:border-red-500 focus:ring-red-500/15"
                  : "border-slate-300 focus:border-[#007185] focus:ring-[#007185]/25"
              }`}
            />
            {errors.referralCode ? (
              <span className="text-xs font-normal text-red-600">{errors.referralCode}</span>
            ) : (
              <span id="referral-code-hint" className="text-xs font-normal text-slate-500">
                Referred by someone? Enter their affiliate ID to be added to their referrals.
              </span>
            )}
          </label>

          <button
            type="submit"
            disabled={loading}
            className="mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#FCD200] bg-[#FFD814] text-[13px] font-medium text-[#0F1111] shadow-[0_2px_5px_0_rgba(213,217,217,0.5)] transition hover:bg-[#F7CA00] active:bg-[#F0B800] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Creating account...
              </>
            ) : (
              "Create account"
            )}
          </button>

          <div className="mt-6 flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-200" />
            Already have an account?
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <Link
            href="/login"
            className="mt-4 flex h-10 w-full items-center justify-center rounded-lg border border-slate-300 bg-linear-to-b from-white to-slate-100 text-[13px] font-medium text-slate-900 shadow-[0_2px_5px_0_rgba(213,217,217,0.5)] transition hover:from-slate-50 hover:to-slate-200"
          >
            Sign in
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
