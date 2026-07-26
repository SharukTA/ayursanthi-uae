import { prisma } from "@/lib/prisma";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/pricing";

// Editable site-wide settings (contact details, social links, delivery rules).
// These are the canonical keys; the admin overrides any of them in
// /admin/settings. Defaults are used until an admin saves a value, so pages
// always have something to show.
export const DEFAULT_SETTINGS = {
  contact_phone: "+91 99999 99999",
  contact_email: "support@ayursanthi.com",
  contact_company: "Ayursanthi Wellness Corp",
  contact_address: "Kochi, Kerala, India",
  contact_hours: "Mon-Sat, 9AM - 6PM",
  contact_dispatch: "98% Same-day dispatch",
  social_facebook: "",
  social_instagram: "",
  social_twitter: "",
  // Goods subtotal (GST-inclusive) at/above which delivery is free. Stored as a
  // string like every setting; read as a number via getFreeShippingThreshold().
  free_shipping_threshold: String(FREE_SHIPPING_THRESHOLD),
};

// Keys that are safe to expose publicly (all of the above are).
export const PUBLIC_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

// Re-exported from the client-safe module so both the server API and the admin
// form (a client component) can validate saves without importing this file,
// which pulls in prisma.
export { NUMERIC_SETTINGS, validateSettings } from "@/lib/settings-shared";

// Read all settings from the DB, merged over the defaults. Server-only.
export async function getSiteSettings() {
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: PUBLIC_SETTING_KEYS } },
    });
    const overrides = {};
    for (const row of rows) {
      if (row.value != null && row.value !== "") overrides[row.key] = row.value;
    }
    return { ...DEFAULT_SETTINGS, ...overrides };
  } catch {
    // DB unreachable — fall back to defaults rather than crash the page.
    return { ...DEFAULT_SETTINGS };
  }
}

// The live free-shipping threshold as a number, guarded against a bad/blank
// admin value. Server-only (reads the DB). The client reads the raw string from
// /api/settings and coerces it the same way.
export async function getFreeShippingThreshold() {
  const settings = await getSiteSettings();
  const n = Number(settings.free_shipping_threshold);
  return Number.isFinite(n) && n >= 0 ? n : FREE_SHIPPING_THRESHOLD;
}
