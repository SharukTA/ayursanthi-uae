"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Settings, ArrowLeft, Loader2, Save, Phone, Share2, Store, Truck, Gift, XCircle } from "lucide-react";
import { FadeIn, PageReveal } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { SOCIAL_SETTINGS, validateSettings } from "@/lib/settings-shared";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/pricing";
import { CURRENCY } from "@/lib/currency";
import { DEFAULT_DRAW_TIME, GIFT_COUPON_THRESHOLD, todayDrawDate } from "@/lib/gift-shared";
import { DEFAULT_CANCEL_WINDOW_HOURS } from "@/lib/order-policy";
import { DEFAULT_SHOP_REFERRAL_RATE, DEFAULT_SHOP_WITHDRAWAL_MINIMUM } from "@/lib/shop-shared";

// Example URLs shown in the social fields. Purely cosmetic — a key missing from
// here just falls back to a generic "https://..." placeholder.
const SOCIAL_PLACEHOLDERS = {
  social_instagram: "https://instagram.com/ayursanthi",
  social_facebook: "https://facebook.com/ayursanthi",
  social_youtube: "https://youtube.com/@ayursanthi",
  social_linkedin: "https://linkedin.com/company/ayursanthi",
  social_twitter: "https://x.com/ayursanthi",
};

// Field groups for the settings form. `key` must match a key in lib/settings.js.
const GROUPS = [
  {
    title: "Contact details",
    icon: Phone,
    fields: [
      { key: "contact_phone", label: "Phone number", placeholder: "+91 99999 99999" },
      { key: "contact_email", label: "Support email", placeholder: "support@ayurshoppee.ae" },
      { key: "contact_company", label: "Company / office name", placeholder: "Ayursanthi Wellness Corp" },
      { key: "contact_address", label: "Address", placeholder: "Kochi, Kerala, India" },
      { key: "contact_hours", label: "Working hours", placeholder: "Mon-Sat, 9AM - 6PM" },
      { key: "contact_dispatch", label: "Fulfillment note", placeholder: "98% Same-day dispatch" },
      {
        key: "consultation_whatsapp",
        label: "Online consultation WhatsApp",
        placeholder: "+91 7306822369",
        hint: "Online consultation forms are sent to this number, and it is shown on that page. Include + and the country code.",
      },
    ],
  },
  {
    title: "Delivery",
    icon: Truck,
    fields: [
      {
        key: "free_shipping_threshold",
        label: `Free-shipping threshold (${CURRENCY})`,
        placeholder: String(FREE_SHIPPING_THRESHOLD),
        type: "number",
        hint: "Orders with a goods subtotal at or above this amount ship free. Below it, the per-product shipping fees apply.",
      },
    ],
  },
  {
    title: "Cancellations",
    icon: XCircle,
    hint: "Cancelling refunds the card and puts stock back, so it only works while the parcel is still here. The window below is what the storefront promises, what the cancel button obeys, and what the API enforces — for customers and for the store alike.",
    fields: [
      {
        key: "order_cancel_window_hours",
        label: "Cancellation window (hours)",
        placeholder: String(DEFAULT_CANCEL_WINDOW_HOURS),
        type: "number",
        min: 1,
        hint: "How long after placing an order a customer — or an admin — can still cancel it. Set it to the point your courier collects and packs: past the window the parcel has gone, and a cancellation would refund goods already in transit. The deadline is shown beside every cancel button and on the Terms page. It also sets how early gift-draw entries close — a coupon cannot be in a draw while the order behind it can still be cancelled — so lengthening this shortens the run-up to each draw.",
      },
    ],
  },
  {
    title: "Gift draw",
    icon: Gift,
    hint: "The giveaway runs to a date you pick. Posters, prizes and winners are managed in Gifts, where the same date and switch can be set alongside the draws they govern.",
    fields: [
      {
        key: "gift_coupon_threshold",
        label: `Coupon threshold (${CURRENCY})`,
        placeholder: String(GIFT_COUPON_THRESHOLD),
        type: "number",
        hint: "Earned on cumulative spend across orders, not per order. Every whole multiple of this a customer has spent since the programme start date earns one gift coupon; the remainder carries forward.",
      },
      {
        key: "gift_draw_date",
        label: "Next draw date",
        // A calendar, floored at today: a draw scheduled for a date already
        // behind us would be frozen by the nightly job on its very next run,
        // closing a giveaway nobody was told about.
        type: "date",
        minToday: true,
        hint: "The day the next draw is held. Moving it moves the entry cutoff — and the earliest day the draw can be run — for the draw not yet closed; draws already closed keep the dates they ran on.",
      },
      {
        key: "gift_draw_time",
        label: "Draw time (Gulf time)",
        placeholder: DEFAULT_DRAW_TIME,
        type: "time",
        hint: "The hour the draw is held, on a 24-hour clock — 13:00 is 1:00 PM. Entries close one cancellation window before this instant, so that nobody can win on an order they can still cancel; anything bought after that cutoff counts towards the next draw.",
      },
      {
        key: "gift_program_enabled",
        label: "Programme enabled",
        type: "toggle",
        hint: "Turn off to stop minting new coupons immediately, and to stop the storefront advertising a draw. Coupons already issued keep their place in the next one.",
      },
    ],
  },
  {
    title: "Shop partners",
    icon: Store,
    fields: [
      {
        key: "shop_referral_rate",
        label: "Referrer profit (%)",
        placeholder: String(DEFAULT_SHOP_REFERRAL_RATE),
        type: "number",
        max: 100,
        step: "0.01",
        hint: "What a shop owner earns on each purchase made through a shop they referred, on top of that shop's own profit. Applies to the goods total, not delivery. A change affects new purchases only.",
      },
      {
        key: "shop_withdrawal_minimum",
        label: `Minimum withdrawal (${CURRENCY})`,
        placeholder: String(DEFAULT_SHOP_WITHDRAWAL_MINIMUM),
        type: "number",
        step: "0.01",
        hint: "A shop owner's available balance has to reach this before a payout can be recorded. Set 0 to allow any balance.",
      },
    ],
  },
  {
    title: "Social links",
    icon: Share2,
    // Generated from SOCIAL_SETTINGS so adding a platform there puts it in this
    // form automatically — the two lists can never fall out of step.
    hint: "Paste the full profile URL, including https://. Leave a field blank to hide that icon.",
    fields: Object.entries(SOCIAL_SETTINGS).map(([key, label]) => ({
      key,
      label: `${label} URL`,
      placeholder: SOCIAL_PLACEHOLDERS[key] || "https://...",
      type: "url",
    })),
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

    // Catch bad numeric settings (e.g. a non-numeric or negative threshold)
    // before the round-trip. The API enforces the same rule server-side.
    const validationError = validateSettings(values);
    if (validationError) {
      toast.error(validationError);
      return;
    }

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
              Contact details, social links, and delivery rules used across the store.
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
                {group.hint ? (
                  <p className="mt-3 text-[11px] font-normal text-slate-500">{group.hint}</p>
                ) : null}
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <label key={field.key} className="grid gap-2 text-xs font-semibold text-slate-800">
                      {field.label}
                      {field.type === "toggle" ? (
                        // Stored as the string "true"/"false" like every other
                        // setting — the settings table has no boolean column,
                        // and isGiftProgramEnabled() reads it back the same way.
                        <select
                          value={values[field.key] === "true" ? "true" : "false"}
                          onChange={(e) => update(field.key, e.target.value)}
                          disabled={saving}
                          className="w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
                        >
                          <option value="true">Enabled</option>
                          <option value="false">Disabled</option>
                        </select>
                      ) : (
                      <input
                        type={field.type || "text"}
                        // `minToday` is resolved at render rather than baked
                        // into the field definition: a console left open
                        // overnight would otherwise keep offering yesterday as
                        // a legal choice.
                        min={
                          field.minToday
                            ? todayDrawDate()
                            : field.type === "number"
                              ? (field.min ?? 0)
                              : undefined
                        }
                        max={field.type === "number" ? field.max : undefined}
                        step={field.type === "number" ? (field.step ?? "1") : undefined}
                        value={values[field.key] ?? ""}
                        onChange={(e) => update(field.key, e.target.value)}
                        disabled={saving}
                        placeholder={field.placeholder}
                        className="w-full min-h-10 rounded border border-input bg-white px-3 text-xs font-normal text-slate-900 outline-none transition focus:border-emerald-700"
                      />
                      )}
                      {field.hint ? (
                        <span className="text-[10px] font-normal text-slate-500">{field.hint}</span>
                      ) : null}
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
