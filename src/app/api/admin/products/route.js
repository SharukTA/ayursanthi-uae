import { prisma } from "@/lib/prisma";
import {
  cleanIngredientList,
  cleanString,
  jsonError,
  prismaErrorResponse,
  readBoolean,  readInteger,
  readMoney,
  requireAdmin,
  slugify,
} from "@/lib/admin-api";

export const runtime = "nodejs";

function buildProductImageData(images) {
  if (!Array.isArray(images) || images.length === 0) {
    return undefined;
  }

  const cleanImages = images
    .map((image, index) => ({
      url: cleanString(image.url),
      altText: cleanString(image.altText),
      mediaType: image.mediaType === "VIDEO" ? "VIDEO" : "IMAGE",
      sortOrder: readInteger(image.sortOrder, index),
    }))
    .filter((image) => image.url);

  return cleanImages.length ? { create: cleanImages } : undefined;
}

function buildProductAttributeData(attributes) {
  if (!Array.isArray(attributes) || attributes.length === 0) {
    return undefined;
  }

  const cleanAttributes = attributes
    .map((attribute, index) => ({
      label: cleanString(attribute.label),
      value: cleanString(attribute.value),
      sortOrder: readInteger(attribute.sortOrder, index),
    }))
    .filter((attribute) => attribute.label && attribute.value);

  return cleanAttributes.length ? { create: cleanAttributes } : undefined;
}

export async function GET(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");
  const categoryId = searchParams.get("categoryId");
  const status = searchParams.get("status");
  const featured = searchParams.get("featured");
  const stock = searchParams.get("stock");

  const products = await prisma.product.findMany({
    where: {
      ...(categoryId ? { categoryId } : {}),
      ...(status === "active" ? { isActive: true } : {}),
      ...(status === "inactive" ? { isActive: false } : {}),
      ...(featured === "true" ? { isFeatured: true } : {}),
      ...(stock === "low" ? { stock: { lte: 5 } } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { slug: { contains: search, mode: "insensitive" } },
              { sku: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
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

  return Response.json({ products });
}

export async function POST(request) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await request.json();
    const name = cleanString(body.name);
    const slug = slugify(body.slug || body.name);
    const sku = cleanString(body.sku);
    const categoryId = cleanString(body.categoryId);
    const price = readMoney(body.price);
    const mrp = readMoney(body.mrp);

    if (!categoryId || !name || !slug || !sku || !price) {
      return jsonError("Category, name, slug, sku, and valid price are required.");
    }

    const product = await prisma.product.create({
      data: {
        categoryId,
        name,
        slug,
        sku,
        shortDescription: cleanString(body.shortDescription),
        description: cleanString(body.description),
        searchKeywords: cleanString(body.searchKeywords),
        price,
        mrp,
        shippingFee: readMoney(body.shippingFee) ?? 0,
        offerLabel: cleanString(body.offerLabel),
        netQuantity: cleanString(body.netQuantity),
        keyIngredients: cleanIngredientList(body.keyIngredients),
        stock: readInteger(body.stock, 0),
        isFeatured: readBoolean(body.isFeatured, false),
        isActive: readBoolean(body.isActive, true),
        images: buildProductImageData(body.images),
        attributes: buildProductAttributeData(body.attributes),
      },
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

    return Response.json({ product }, { status: 201 });
  } catch (error) {
    return prismaErrorResponse(error, "Unable to create product.");
  }
}
