import { getSiteSettings } from "@/lib/settings";

export const runtime = "nodejs";

// GET /api/settings — public, read-only site settings (contact + socials).
// Consumed by the footer and contact page.
export async function GET() {
  const settings = await getSiteSettings();
  return Response.json({ settings });
}
