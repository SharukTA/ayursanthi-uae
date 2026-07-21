import { getPageSections } from "@/lib/page-sections";
import { SECTION_PLACEMENTS } from "@/lib/admin-api";

export const runtime = "nodejs";

// GET /api/page-sections?placement=CHECKOUT — public, read-only feed of the
// active CMS sections for a placement, for client components that can't fetch on
// the server (e.g. the checkout page is a client component and only needs its
// single banner). Returns render-ready sections + stats from the shared helper.
export async function GET(request) {
  const placement = new URL(request.url).searchParams.get("placement");

  if (!placement || !SECTION_PLACEMENTS.includes(placement)) {
    return Response.json({ message: "A valid placement is required." }, { status: 400 });
  }

  const { sections, stats } = await getPageSections(placement);
  return Response.json({ sections, stats });
}
