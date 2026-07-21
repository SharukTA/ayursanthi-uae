import { getUpcomingDraw } from "@/lib/gift-draws";

export const runtime = "nodejs";

// GET /api/gifts/next-draw — PUBLIC community progress toward the next milestone
// draw. Powers the "next draw" progress on the homepage gift block, the dashboard
// rewards page, and the /gifts page, so even logged-out visitors can see how close
// the next draw is. Shape: { payingCount, nextDraw: null | { label, memberThreshold,
// remaining, pct, reached, gifts } }.
export async function GET() {
  try {
    const data = await getUpcomingDraw();
    return Response.json(data);
  } catch (e) {
    console.error(e);
    return Response.json(
      { message: "Failed to load the next draw." },
      { status: 503 }
    );
  }
}
