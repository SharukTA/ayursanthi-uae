import { clearSession } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  try {
    await clearSession();
    return Response.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return Response.json(
      { message: "Internal server error during logout." },
      { status: 500 }
    );
  }
}
