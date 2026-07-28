import { prisma } from "@/lib/prisma";
import { deleteByUrl, isManagedUrl } from "@/lib/storage";
import { jsonError, prismaErrorResponse, requireAdmin } from "@/lib/admin-api";

export const runtime = "nodejs";

// Delete the backing file for a media URL, but only for files we host and only
// when no other product image still points at it. `deleteByUrl` ignores anything
// the active storage driver does not own, such as externally pasted URLs.
async function maybeDeleteUploadedFile(url) {
  if (!url || !isManagedUrl(url)) return;

  const stillReferenced = await prisma.productImage.count({ where: { url } });
  if (stillReferenced > 0) return;

  try {
    await deleteByUrl(url);
  } catch (error) {
    // A missing object is fine — the goal (no orphan) is already met.
    console.error("Failed to delete uploaded media file:", error);
  }
}

// DELETE /api/admin/products/[id]/images/[imageId] — removes a single image or
// video from a product immediately (no full-product save needed) and cleans up
// the uploaded file from disk when nothing else references it.
export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id, imageId } = await params;

    const image = await prisma.productImage.findUnique({
      where: { id: imageId },
    });

    if (!image || image.productId !== id) {
      return jsonError("Media not found for this product.", 404);
    }

    await prisma.productImage.delete({ where: { id: imageId } });
    await maybeDeleteUploadedFile(image.url);

    return Response.json({ message: "Media deleted successfully." });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to delete media.");
  }
}
