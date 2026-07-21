import { prisma } from "@/lib/prisma";
import {
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,
  readInteger,
  readMoney,
  requireAdmin,
  slugify,
} from "@/lib/admin-api";

export const runtime = "nodejs";

function normalizeImages(images) {
  if (!Array.isArray(images)) {
    return null;
  }

  return images
    .map((image, index) => ({
      url: cleanString(image.url),
      altText: cleanString(image.altText),
      mediaType: image.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
      sortOrder: readInteger(image.sortOrder, index),
    }))
    .filter((image) => image.url);
}

function normalizeAttributes(attributes) {
  if (!Array.isArray(attributes)) {
    return null;
  }

  return attributes
    .map((attribute, index) => ({
      label: cleanString(attribute.label),
      value: cleanString(attribute.value),
      sortOrder: readInteger(attribute.sortOrder, index),
    }))
    .filter((attribute) => attribute.label && attribute.value);
}

export async function GET(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      images: {
        orderBy: { sortOrder: "asc" },
      },
      attributes: {
        orderBy: { sortOrder: "asc" },
      },
      reviews: {
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    return jsonError("Product not found.", 404);
  }

  return Response.json({ product });
}

export async function PATCH(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;
    const body = await request.json();
    const data = {};

    if ("categoryId" in body) {
      data.categoryId = cleanString(body.categoryId);
    }

    if ("name" in body) {
      const name = cleanString(body.name);

      if (!name) {
        return jsonError("Product name cannot be empty.");
      }

      data.name = name;
    }

    if ("slug" in body || "name" in body) {
      const slug = slugify(body.slug || body.name);

      if (!slug) {
        return jsonError("Product slug cannot be empty.");
      }

      data.slug = slug;
    }

    if ("sku" in body) {
      const sku = cleanString(body.sku);

      if (!sku) {
        return jsonError("Product SKU cannot be empty.");
      }

      data.sku = sku;
    }

    if ("shortDescription" in body) {
      data.shortDescription = cleanString(body.shortDescription);
    }

    if ("description" in body) {
      data.description = cleanString(body.description);
    }

    if ("searchKeywords" in body) {
      data.searchKeywords = cleanString(body.searchKeywords);
    }

    if ("price" in body) {
      const price = readMoney(body.price);

      if (!price) {
        return jsonError("Valid product price is required.");
      }

      data.price = price;
    }

    if ("mrp" in body) {
      data.mrp = readMoney(body.mrp);
    }

    if ("offerLabel" in body) {
      data.offerLabel = cleanString(body.offerLabel);
    }

    if ("stock" in body) {
      data.stock = readInteger(body.stock, 0);
    }

    if ("isFeatured" in body) {
      data.isFeatured = readBoolean(body.isFeatured, false);
    }

    if ("isReferralReward" in body) {
      data.isReferralReward = readBoolean(body.isReferralReward, false);
    }

    if ("isActive" in body) {
      data.isActive = readBoolean(body.isActive, true);
    }

    const images = normalizeImages(body.images);
    const attributes = normalizeAttributes(body.attributes);

    const product = await prisma.$transaction(async (tx) => {
      const updatedProduct = await tx.product.update({
        where: { id },
        data,
      });

      if (images) {
        await tx.productImage.deleteMany({
          where: { productId: id },
        });

        if (images.length) {
          await tx.productImage.createMany({
            data: images.map((image) => ({
              productId: id,
              ...image,
            })),
          });
        }
      }

      if (attributes) {
        await tx.productAttribute.deleteMany({
          where: { productId: id },
        });

        if (attributes.length) {
          await tx.productAttribute.createMany({
            data: attributes.map((attribute) => ({
              productId: id,
              ...attribute,
            })),
          });
        }
      }

      return tx.product.findUnique({
        where: { id: updatedProduct.id },
        include: {
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          images: {
            orderBy: { sortOrder: "asc" },
          },
          attributes: {
            orderBy: { sortOrder: "asc" },
          },
        },
      });
    });

    return Response.json({ product });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to update product.");
  }
}

export async function DELETE(request, { params }) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const { id } = await params;

    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        images: true,
      },
    });

    return Response.json({
      product,
      message: "Product disabled successfully.",
    });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to disable product.");
  }
}
