import { prisma } from "@/lib/prisma";
import { ADMIN_SETTING_KEYS, getAdminSettings, validateSettings } from "@/lib/settings";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// GET /api/admin/settings — current settings (defaults merged with overrides).
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const settings = await getAdminSettings();
  return Response.json({ settings });
}

// PUT /api/admin/settings — bulk upsert. Body: { settings: { key: value, ... } }.
// Only known keys are persisted; empty values are stored as "" (cleared).
export async function PUT(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const incoming = body.settings;

    if (!incoming || typeof incoming !== "object") {
      return jsonError("A settings object is required.");
    }

    const validationError = validateSettings(incoming);
    if (validationError) {
      return jsonError(validationError);
    }

    const entries = Object.entries(incoming).filter(([key]) =>
      ADMIN_SETTING_KEYS.includes(key)
    );

    await prisma.$transaction(
      entries.map(([key, value]) =>
        prisma.siteSetting.upsert({
          where: { key },
          update: { value: value == null ? "" : String(value).trim() },
          create: { key, value: value == null ? "" : String(value).trim() },
        })
      )
    );

    const settings = await getAdminSettings();
    return Response.json({ settings });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to save settings.");
  }
}
