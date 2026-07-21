"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings, ArrowLeft, Loader2, Save, Phone, Share2 } from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";

// Field groups for the settings form. `key` must match a key in lib/settings.js.
const GROUPS = [
  {
    title: "Contact details",
    icon: Phone,
    fields: [
      { key: "contact_phone", label: "Phone number", placeholder: "+91 99999 99999" },
      { key: "contact_email", label: "Support email", placeholder: "support@ayursanthi.com" },
      { key: "contact_company", label: "Company / office name", placeholder: "Ayursanthi Wellness Corp" },
      { key: "contact_address", label: "Address", placeholder: "Kochi, Kerala, India" },
      { key: "contact_hours", label: "Working hours", placeholder: "Mon-Sat, 9AM - 6PM" },
      { key: "contact_dispatch", label: "Fulfillment note", placeholder: "98% Same-day dispatch" },
    ],
  },
  {
    title: "Social links",
    icon: Share2,
    fields: [
      { key: "social_facebook", label: "Facebook URL", placeholder: "https://facebook.com/..." },
      { key: "social_instagram", label: "Instagram URL", placeholder: "https://instagram.com/..." },
      { key: "social_twitter", label: "X / Twitter URL", placeholder: "https://x.com/..." },
    ],
  },
];

export default function AdminSettingsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

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
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        setValues(data.settings || {});
      } catch (e) {
        console.error("Initial load failure:", e);
      } finally {
        setLoading(false);
      }
    }
    initPage();
  }, []);

  function update(key, value) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading("Saving settings...");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: values }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save settings.");
      setValues(data.settings || values);
      toast.success("Settings saved.", { id: toastId });
    } catch (error) {
      toast.error(error.message || "Error saving settings.", { id: toastId });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !authChecked) {
    return (
      <main className="min-h-screen bg-slate-50 text-white flex flex-col">
        <SiteHeader />
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm font-semibold text-slate-500">Accessing administrative dashboard...</p>
        </div>
        <SiteFooter />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <section className="bg-slate-950 py-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PageReveal>
            <Link href="/admin" className="inline-flex items-center gap-1 text-xs font-semibold text-white/70 hover:text-white mb-2">
              <ArrowLeft className="size-3" />
              Console Home
            </Link>
            <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
              <Settings className="size-7 text-emerald-400" />
              Site Settings
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Contact details and social links shown on the Contact page and footer.
            </p>
          </PageReveal>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full">
        <form onSubmit={handleSave} className="grid gap-6">
          {GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <FadeIn key={group.title} className="rounded-md border border-border bg-white p-6 shadow-sm">
                <h2 className="text-base font-bold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Icon className="size-5 text-emerald-700" />
                  {group.title}
                </h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <label key={field.key} className="grid gap-2 text-xs font-semibold text-slate-800">
                      {field.label}
                      <input
                        type="text"
                        value={values[field.key] ?? ""}
                        onChange={(e) => update(field.key, e.target.value)}
                        disabled={saving}
                        placeholder={field.placeholder}
                        className="w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
                      />
                    </label>
                  ))}
                </div>
              </FadeIn>
            );
          })}

          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="h-10 bg-emerald-700 hover:bg-emerald-800 rounded-md text-xs font-semibold px-6">
              {saving ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="size-3.5 mr-1.5" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        </form>
      </section>

      <SiteFooter />
    </main>
  );
}
