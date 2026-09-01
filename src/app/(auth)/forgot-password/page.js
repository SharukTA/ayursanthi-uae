"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { Logo3D } from "@/components/Logo3D";
import { PasswordField } from "@/components/PasswordField";
import { validatePassword } from "@/lib/validation";

// Amazon-style 3-step password reset:
//   email    -> submit the account email, we send a 6-digit OTP
//   otp      -> enter the code, verified server-side (not yet consumed)
//   password -> set + confirm the new password (consumes the code)
//   done     -> success, link back to sign in
//
// Email only: the OTP is delivered by email (lib/email.js) and there is no SMS
// sender wired up, so offering "email or mobile" here would promise a text
// message that never arrives. The API still resolves a mobile number to its
// account — see lib/reset-otp.js — so this is a UI restriction, and re-adding
// the mobile option later needs only the copy below plus a real SMS provider.
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState("email");
  const [loading, setLoading] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const inputClass =
    "min-h-12 w-full rounded-md border border-slate-300 bg-white px-4 text-sm font-normal text-slate-900 outline-none transition focus:border-[#007185] focus:ring-4 focus:ring-[#007185]/25 disabled:opacity-60";
  const yellowButton =
    "mt-6 flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#FCD200] bg-[#FFD814] text-[13px] font-medium text-[#0F1111] shadow-[0_2px_5px_0_rgba(213,217,217,0.5)] transition hover:bg-[#F7CA00] active:bg-[#F0B800] disabled:cursor-not-allowed disabled:opacity-60";

  // Step 1 — request the OTP.
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) {
      toast.error("Please enter your email address.");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Sending your code...");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setMaskedEmail(data.maskedEmail || "");
      toast.success("If the account exists, a code is on its way to your email.", { id: toastId });
      setStep("otp");
    } catch (err) {
      toast.error(err.message || "Something went wrong. Please try again.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify the OTP (does not consume it).
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.trim().length !== 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Verifying code...");
    try {
      const res = await fetch("/api/auth/verify-reset-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Code verified.", { id: toastId });
      setStep("password");
    } catch (err) {
      toast.error(err.message || "That code is invalid or has expired.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Step 3 — set the new password (consumes the OTP).
  const handleResetPassword = async (e) => {
    e.preventDefault();
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      toast.error(passwordError);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Saving your new password...");
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, otp, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success("Password reset successfully.", { id: toastId });
      setStep("done");
    } catch (err) {
      toast.error(err.message || "Something went wrong. Please try again.", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setOtp("");
    await handleSendOtp({ preventDefault() {} });
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-50 text-slate-900"
      style={{ fontFamily: '"Amazon Ember", Arial, sans-serif' }}
    >
      <header className="border-b border-white/10 bg-[#232f3e]">
        <div className="mx-auto flex max-w-7xl items-center px-4 py-2 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Ayursanthi home">
            <Logo3D size={72} />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-sm rounded-md border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          {/* STEP 1 — account email */}
          {step === "email" && (
            <form onSubmit={handleSendOtp}>
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Password assistance</h1>
              <p className="mt-2 text-sm text-slate-600">
                Enter the email address associated with your account and we&apos;ll send you a
                one-time password.
              </p>

              <label className="mt-6 grid gap-2 text-sm font-semibold text-slate-900">
                Email
                <input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  disabled={loading}
                  required
                  className={inputClass}
                />
              </label>

              <button type="submit" disabled={loading} className={yellowButton}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Sending...
                  </>
                ) : (
                  "Send OTP"
                )}
              </button>

              <div className="mt-6 flex items-center justify-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1 text-sm text-[#007185] hover:text-[#c7511f] hover:underline"
                >
                  <ArrowLeft className="size-3.5" /> Back to sign in
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2 — OTP */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp}>
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Enter the code</h1>
              <p className="mt-2 text-sm text-slate-600">
                We sent a 6-digit one-time password
                {maskedEmail ? (
                  <>
                    {" "}to <span className="font-semibold text-slate-900">{maskedEmail}</span>
                  </>
                ) : (
                  " to your registered email"
                )}
                . It expires in 10 minutes.
              </p>

              <label className="mt-6 grid gap-2 text-sm font-semibold text-slate-900">
                One-time password (OTP)
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  disabled={loading}
                  required
                  className={`${inputClass} text-center text-lg font-semibold tracking-[0.5em]`}
                />
              </label>

              <button type="submit" disabled={loading} className={yellowButton}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Verifying...
                  </>
                ) : (
                  "Verify OTP"
                )}
              </button>

              <div className="mt-6 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => setStep("email")}
                  className="inline-flex items-center gap-1 text-[#007185] hover:text-[#c7511f] hover:underline"
                >
                  <ArrowLeft className="size-3.5" /> Change email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={loading}
                  className="text-[#007185] hover:text-[#c7511f] hover:underline disabled:opacity-60"
                >
                  Resend code
                </button>
              </div>
            </form>
          )}

          {/* STEP 3 — new password */}
          {step === "password" && (
            <form onSubmit={handleResetPassword}>
              <h1 className="text-xl font-semibold text-slate-900 sm:text-2xl">Create new password</h1>
              <p className="mt-2 text-sm text-slate-600">
                Choose a strong password you don&apos;t use elsewhere. Minimum 8 characters, with a letter and a number.
              </p>

              <label className="mt-6 grid gap-2 text-sm font-semibold text-slate-900">
                New password
                <PasswordField
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  className={inputClass}
                />
              </label>

              <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-900">
                Re-enter password
                <PasswordField
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  className={inputClass}
                />
                {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                  <span className="text-[11px] font-medium text-rose-600">Passwords do not match.</span>
                )}
              </label>

              <button type="submit" disabled={loading} className={yellowButton}>
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving...
                  </>
                ) : (
                  "Save changes and sign in"
                )}
              </button>
            </form>
          )}

          {/* STEP 4 — done */}
          {step === "done" && (
            <div className="text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50">
                <CheckCircle2 className="size-7 text-emerald-600" />
              </div>
              <h1 className="mt-4 text-xl font-semibold text-slate-900 sm:text-2xl">Password changed</h1>
              <p className="mt-2 text-sm text-slate-600">
                Your password has been reset. You can now sign in with your new password.
              </p>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className={yellowButton}
              >
                Go to sign in
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-white/10 bg-linear-to-b from-[#0c403f] to-[#06201f]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <p className="text-xs text-white">&copy; 2026 Ayurshoppee. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
