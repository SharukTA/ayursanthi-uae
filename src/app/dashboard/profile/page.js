"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  User,
  Mail,
  Phone,
  Link2,
  Calendar,
  Save,
  Loader2,
  KeyRound,
  ShoppingBag,
  Users,
} from "lucide-react";
import Link from "next/link";
import { FadeIn, PageReveal } from "@/components/Animated";
import { Button } from "@/components/ui/button";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetch("/api/user/profile")
      .then((r) => r.json())
      .then((data) => {
        setProfile(data.user);
        setName(data.user?.name || "");
        setPhone(data.user?.phone || "");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    const toastId = toast.loading("Saving profile...");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setProfile((p) => ({ ...p, name: data.user.name, phone: data.user.phone }));
      toast.success("Profile updated successfully.", { id: toastId });
      setEditing(false);
      window.dispatchEvent(new Event("authUpdate"));
      router.refresh();
    } catch (e) {
      toast.error(e.message || "Failed to update profile.", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setName(profile?.name || "");
    setPhone(profile?.phone || "");
  };

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center">
        <p className="animate-pulse text-sm font-medium text-white">Loading profile...</p>
      </div>
    );
  }

  const infoField = (label, icon, value, editNode) => {
    const Icon = icon;
    return (
      <div className="grid gap-2">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
          <Icon className="size-3.5" />
          {label}
        </span>
        {editing && editNode ? editNode : (
          <p className="text-sm font-medium text-[#0f1111]">{value || "—"}</p>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageReveal>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="mt-1 text-sm text-[#3f4545]">View and manage your personal information.</p>
      </PageReveal>

      {/* Main profile card */}
      <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between border-b border-[#d5d9d9] pb-5">
          <div className="flex items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-full bg-[#232f3e] text-2xl font-extrabold text-white">
              {profile?.name?.charAt(0)?.toUpperCase() ?? "U"}
            </span>
            <div>
              <h2 className="text-base font-bold text-[#0f1111]">{profile?.name}</h2>
              <p className="mt-0.5 text-xs text-[#565959]">{profile?.email}</p>
              <span className="mt-1.5 inline-flex items-center rounded border border-[#d5d9d9] bg-[#f7fafa] px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-[#0f1111]">
                {profile?.role}
              </span>
            </div>
          </div>

          {!editing && (
            <Button
              onClick={() => setEditing(true)}
              variant="outline"
              className="h-9 rounded text-xs bg-[#232f3e] text-white border-[#adb1b8] hover:bg-[#131921] hover:text-white"
            >
              Edit Profile
            </Button>
          )}
        </div>

        {/* Fields grid */}
        <div className="grid gap-6 sm:grid-cols-2">
          {infoField("Full Name", User, profile?.name,
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={saving}
              className="min-h-10 rounded border border-[#d5d9d9] bg-white px-3 text-sm text-[#0f1111] placeholder:text-[#565959] outline-none focus:border-[#007185] focus:ring-4 focus:ring-[#007185]/25 disabled:opacity-60"
            />
          )}

          {infoField("Email Address", Mail, profile?.email, null)}

          {infoField("Phone Number", Phone, profile?.phone || "—",
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={saving}
              placeholder="Enter phone number"
              className="min-h-10 rounded border border-[#d5d9d9] bg-white px-3 text-sm text-[#0f1111] placeholder:text-[#565959] outline-none focus:border-[#007185] focus:ring-4 focus:ring-[#007185]/25 disabled:opacity-60"
            />
          )}

          <div className="grid gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#565959]">
              <Link2 className="size-3.5" />
              Referral Code
            </span>
            <div className="flex items-center gap-2">
              <code className="rounded border border-[#d5d9d9] bg-[#f8fafc] px-2.5 py-1.5 font-mono text-xs font-bold text-[#0f1111]">
                {profile?.referralCode || "—"}
              </code>
              {profile?.referralCode && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(profile.referralCode);
                    toast.success("Referral code copied!");
                  }}
                  className="text-xs font-semibold text-[#0f1111] hover:underline"
                >
                  Copy
                </button>
              )}
            </div>
          </div>

          {infoField(
            "Member Since",
            Calendar,
            profile?.createdAt
              ? new Date(profile.createdAt).toLocaleDateString("en-IN", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              : "—"
          )}

          {infoField("Referred By", Users, profile?.referredBy?.name || "Direct Registration")}
        </div>

        {/* Save / Cancel */}
        {editing && (
          <div className="mt-6 flex gap-3 border-t border-[#d5d9d9] pt-5">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="h-10 rounded bg-[#232f3e] text-sm text-white hover:bg-[#131921]"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 size-4" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelEdit}
              disabled={saving}
              className="h-10 rounded text-sm border-[#adb1b8] text-[#0f1111] bg-white hover:bg-[#f8fafc] hover:text-[#007185]"
            >
              Cancel
            </Button>
          </div>
        )}
      </FadeIn>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FadeIn className="flex items-center gap-4 rounded-md border border-border bg-white p-5 shadow-sm">
          <span className="flex size-11 items-center justify-center rounded-md bg-[#232f3e] text-white">
            <ShoppingBag className="size-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">Total Orders</p>
            <p className="mt-0.5 text-xl font-extrabold text-[#0f1111]">
              {profile?._count?.orders ?? 0}
            </p>
          </div>
        </FadeIn>

        <FadeIn className="flex items-center gap-4 rounded-md border border-border bg-white p-5 shadow-sm">
          <span className="flex size-11 items-center justify-center rounded-md bg-[#232f3e] text-white">
            <Users className="size-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#565959]">Referrals Made</p>
            <p className="mt-0.5 text-xl font-extrabold text-[#0f1111]">
              {profile?._count?.referrals ?? 0}
            </p>
          </div>
        </FadeIn>
      </div>

      {/* Security card */}
      <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 border-b border-[#d5d9d9] pb-3 text-sm font-bold text-[#0f1111]">
          <KeyRound className="size-4 text-[#0f1111]" />
          Password & Security
        </h3>
        <p className="mb-4 text-xs text-[#3f4545]">
          Keep your account secure by using a strong, unique password.
        </p>
        <Button asChild variant="outline" className="h-9 rounded text-xs bg-[#232f3e] text-white border-[#adb1b8] hover:bg-[#131921] hover:text-white">
          <Link href="/dashboard/change-password">Change Password</Link>
        </Button>
      </FadeIn>
    </div>
  );
}
