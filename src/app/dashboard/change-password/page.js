"use client";

import { useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { Button } from "@/components/ui/button";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [success, setSuccess] = useState(false);

  const passwordStrength = () => {
    if (!newPassword) return null;
    if (newPassword.length < 6) return { label: "Too short", color: "bg-rose-500", width: "w-1/4" };
    if (newPassword.length < 8) return { label: "Weak", color: "bg-amber-500", width: "w-2/4" };
    if (newPassword.length < 12) return { label: "Good", color: "bg-indigo-500", width: "w-3/4" };
    return { label: "Strong", color: "bg-emerald-500", width: "w-full" };
  };

  const strength = passwordStrength();
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    const toastId = toast.loading("Updating your password...");

    try {
      const res = await fetch("/api/user/password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success("Password updated successfully.", { id: toastId });
      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      toast.error(e.message || "Failed to update password.", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageReveal>
        <h1 className="text-2xl font-bold text-[#0f1111]">Change Password</h1>
        <p className="mt-1 text-sm text-[#3f4545]">
          Keep your account secure with a strong, unique password.
        </p>
      </PageReveal>

      <FadeIn className="max-w-md">
        {success && (
          <div className="mb-5 flex items-start gap-3 rounded-md border-2 border-[#d5d9d9] bg-white p-4 text-sm text-[#0f1111] shadow-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-[#0f1111]" />
            <p className="font-medium">
              Password changed successfully! Your account is now secured with the new password.
            </p>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-md border border-border bg-white p-6 shadow-sm"
        >
          <div className="flex items-center gap-3 border-b border-[#d5d9d9] pb-4">
            <span className="flex size-9 items-center justify-center rounded-md bg-[#232f3e] text-white">
              <KeyRound className="size-4" />
            </span>
            <h2 className="text-sm font-bold text-[#0f1111]">Update Password</h2>
          </div>

          {/* Current password */}
          <label className="grid gap-2 text-xs font-semibold text-[#0f1111]">
            Current Password
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                disabled={saving}
                placeholder="Enter your current password"
                className="w-full min-h-11 rounded border border-[#d5d9d9] bg-white px-3 pr-10 text-sm font-normal text-[#0f1111] placeholder:text-[#565959] outline-none transition focus:border-[#007185] focus:ring-4 focus:ring-[#007185]/25 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#565959] hover:text-[#007185] transition"
              >
                {showCurrent ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>

          {/* New password */}
          <label className="grid gap-2 text-xs font-semibold text-[#0f1111]">
            New Password
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={saving}
                placeholder="Minimum 6 characters"
                className="w-full min-h-11 rounded border border-[#d5d9d9] bg-white px-3 pr-10 text-sm font-normal text-[#0f1111] placeholder:text-[#565959] outline-none transition focus:border-[#007185] focus:ring-4 focus:ring-[#007185]/25 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#565959] hover:text-[#007185] transition"
              >
                {showNew ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {/* Strength indicator */}
            {strength && (
              <div className="mt-0.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#eaeded]">
                  <div
                    className={`h-full rounded-full transition-all ${strength.color} ${strength.width}`}
                  />
                </div>
                <span className="text-[10px] font-bold text-[#0f1111]">
                  {strength.label}
                </span>
              </div>
            )}
          </label>

          {/* Confirm password */}
          <label className="grid gap-2 text-xs font-semibold text-[#0f1111]">
            Confirm New Password
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={saving}
                placeholder="Repeat your new password"
                className={`w-full min-h-11 rounded border bg-white px-3 pr-10 text-sm font-normal text-[#0f1111] placeholder:text-[#565959] outline-none transition focus:ring-4 focus:ring-[#007185]/25 disabled:opacity-60 ${
                  confirmPassword.length > 0
                    ? passwordsMatch
                      ? "border-[#adb1b8] focus:border-[#007185]"
                      : "border-rose-500 focus:border-rose-600"
                    : "border-[#d5d9d9] focus:border-[#007185]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#565959] hover:text-[#007185] transition"
              >
                {showConfirm ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-[11px] font-medium text-rose-600">Passwords do not match.</p>
            )}
          </label>

          <Button
            type="submit"
            disabled={saving || (confirmPassword.length > 0 && !passwordsMatch)}
            className="mt-1 h-11 rounded bg-[#232f3e] text-sm text-white hover:bg-[#131921]"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Password"
            )}
          </Button>
        </form>
      </FadeIn>
    </div>
  );
}
