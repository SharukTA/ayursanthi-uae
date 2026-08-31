import { getSiteSettings } from "@/lib/settings";

export const runtime = "nodejs";

// GET /api/settings — public, read-only site settings (contact + socials +
// delivery rules). The footer and contact page no longer use this: they read the
// same values from SettingsProvider, which the root layout seeds server-side.
// It is still the source for the client-side free-shipping threshold on the
// cart, checkout and admin-products pages, which could also move to the
// provider if that fetch ever becomes worth removing.
export async function GET() {
  const settings = await getSiteSettings();
  return Response.json({ settings });
}
