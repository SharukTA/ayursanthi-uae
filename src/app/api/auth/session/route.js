import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ loggedIn: false });
    }
    return Response.json({ loggedIn: true, session });
  } catch (error) {
    console.error("Session fetch error:", error);
    return Response.json({ loggedIn: false }, { status: 500 });
  }
}
