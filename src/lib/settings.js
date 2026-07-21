import { prisma } from "@/lib/prisma";

// Editable site-wide settings (contact details, social links). These are the
// canonical keys; the admin overrides any of them in /admin/settings. Defaults
// are used until an admin saves a value, so pages always have something to show.
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
};

// Keys that are safe to expose publicly (all of the above are).
export const PUBLIC_SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

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
