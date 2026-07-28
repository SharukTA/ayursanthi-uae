/**
 * The account cart — the SIGNED-IN half of the shopping cart.
 *
 * Amazon's model, which this follows: a signed-in shopper's cart lives on their
 * account, so it is the same cart on their phone, their laptop and a borrowed
 * computer. Signed-out visitors get a cart in their own browser instead
 * (lib/cart-client.js) which is folded into the account on sign-in and then
 * dropped — see mergeGuestCart below.
 *
 * Only quantity and the per-line checkbox are stored. Name, price, delivery
 * fee and imagery are read from the Product on every single request, so
 * a cart saved last month can never quote last month's price. The one number a
 * caller may not trust is what the browser sends: quantities are always clamped
 * against live stock here, and lib/checkout.js recomputes every amount from the
 * database again before an order is written.
 */

import { prisma } from "@/lib/prisma";

// Amazon caps a single cart line at 30 units. The real ceiling is whatever is
// actually in stock — whichever of the two is lower wins.
export const MAX_LINE_QUANTITY = 30;

// Everything the cart and checkout screens need to render a line. Selected fresh
// on every read on purpose (see the file header).
const CART_ITEM_INCLUDE = {
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      shippingFee: true,
      netQuantity: true,
      stock: true,
      images: {
        orderBy: { sortOrder: "asc" },
        take: 1,
        select: { url: true, mediaType: true },
      },
    },
  },
};

/** Cheap shape check before an id is ever put in a query. */
export function isValidProductId(id) {
  return typeof id === "string" && id.length > 0 && id.length <= 64;
}

/**
 * Coerce a caller-supplied quantity into something sellable: a whole number
 * between 0 and min(stock, MAX_LINE_QUANTITY). Returns 0 when the input is not a
 * usable number, which callers treat as "remove this line".
 */
export function clampQuantity(quantity, stock) {
  const requested = Math.floor(Number(quantity));
  if (!Number.isFinite(requested)) return 0;
  const ceiling = Math.min(MAX_LINE_QUANTITY, Math.max(Number(stock) || 0, 0));
  return Math.max(0, Math.min(requested, ceiling));
}

/**
 * A stored row → the line-item shape the cart/checkout screens render.
 *
 * This is deliberately identical to the shape the browser cart uses for
 * signed-out visitors, so every screen renders one thing and never branches on
 * where the cart came from.
 */
export function serializeCartLine(row) {
  const product = row.product;
  const media = product.images?.[0] || null;

  return {
    productId: product.id,
    name: product.name,
    netQuantity: product.netQuantity || null,
    price: Number(product.price),
    shippingFee: Number(product.shippingFee) || 0,
    image: media?.url || "",
    imageMediaType: media?.mediaType || null,
    slug: product.slug,
    // Live stock travels with the line so the cart can cap the "+" button and
    // flag anything that sold out since it was added.
    stock: product.stock,
    quantity: row.quantity,
    selected: row.selected,
  };
}

/**
 * Every line of one shopper's cart, oldest first.
 *
 * Lines whose product has been retired (`isActive: false`) are hidden rather
 * than deleted — the same way a retired product silently leaves the
 * recently-viewed strip. If it is ever put back on sale it reappears in the
 * carts it was already sitting in.
 */
export async function getUserCart(userId) {
  const rows = await prisma.cartItem.findMany({
    where: { userId, product: { isActive: true } },
    include: CART_ITEM_INCLUDE,
    orderBy: { createdAt: "asc" },
  });
  return rows.map(serializeCartLine);
}

/**
 * Add to cart. Adding a product already in the cart ADDS to the existing line
 * rather than replacing it — "add 2" on top of "3 in cart" means 5, which is
 * what every shopper expects and what Amazon does.
 *
 * @returns {Promise<{error?:string, capped?:boolean, quantity?:number}>}
 */
export async function addToUserCart(userId, productId, quantity) {
  if (!isValidProductId(productId)) {
    return { error: "That product could not be found." };
  }

  const product = await prisma.product.findFirst({
    where: { id: productId, isActive: true },
    select: { id: true, stock: true },
  });

  if (!product) return { error: "That product is no longer available." };
  if (product.stock <= 0) return { error: "This product is currently out of stock." };

  const existing = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { quantity: true },
  });

  const wanted = Math.max(1, Math.floor(Number(quantity)) || 1);
  const requested = (existing?.quantity || 0) + wanted;
  const next = clampQuantity(requested, product.stock);

  await prisma.cartItem.upsert({
    where: { userId_productId: { userId, productId } },
    // Adding an item always (re-)selects it: the shopper just asked for it, so
    // it should be part of the next checkout even if the old line was unticked.
    create: { userId, productId, quantity: next, selected: true },
    update: { quantity: next, selected: true },
  });

  return { capped: next < requested, quantity: next };
}

/**
 * Change one line's quantity and/or its checkbox. A quantity of 0 or less
 * removes the line, so the cart's "−" button needs no special case at 1.
 *
 * @returns {Promise<{error?:string, removed?:boolean, capped?:boolean}>}
 */
export async function setUserCartLine(userId, productId, { quantity, selected }) {
  if (!isValidProductId(productId)) {
    return { error: "That product could not be found." };
  }

  const existing = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
    select: { id: true, product: { select: { stock: true } } },
  });

  if (!existing) return { error: "That item is no longer in your cart." };

  const data = {};
  let capped = false;

  if (quantity !== undefined) {
    const requested = Math.floor(Number(quantity));

    if (!Number.isFinite(requested) || requested <= 0) {
      await prisma.cartItem.delete({ where: { id: existing.id } });
      return { removed: true };
    }

    // Sold out since it was added: refuse the change rather than silently
    // clamping to 0 and deleting a line the shopper only meant to adjust.
    if (existing.product.stock <= 0) {
      return { error: "This product is currently out of stock." };
    }

    const next = clampQuantity(requested, existing.product.stock);
    capped = next < requested;
    data.quantity = next;
  }

  if (selected !== undefined) data.selected = Boolean(selected);
  if (Object.keys(data).length === 0) return {};

  await prisma.cartItem.update({ where: { id: existing.id }, data });
  return { capped };
}

/** Tick or untick every line at once — the cart's "Select all items" box. */
export async function setAllCartLinesSelected(userId, selected) {
  await prisma.cartItem.updateMany({
    where: { userId },
    data: { selected: Boolean(selected) },
  });
}

/** Remove specific products from the cart. */
export async function removeFromUserCart(userId, productIds) {
  const ids = (Array.isArray(productIds) ? productIds : []).filter(isValidProductId);
  if (ids.length === 0) return;
  await prisma.cartItem.deleteMany({ where: { userId, productId: { in: ids } } });
}

/** Empty the cart entirely. */
export async function clearUserCart(userId) {
  await prisma.cartItem.deleteMany({ where: { userId } });
}

/**
 * Fold a signed-out visitor's browser cart into their account on sign-in.
 *
 * Amazon's merge rule, which this implements: quantities are ADDED per product.
 * Two of something in the browser cart plus three already on the account is a
 * line of five — nothing the shopper picked is ever silently dropped. The sum is
 * then clamped to live stock (and to MAX_LINE_QUANTITY), so the merge can never
 * produce a line that could not be sold.
 *
 * Only the productId and quantity from the browser are trusted; the browser's
 * cached price/name are ignored entirely and re-read from the Product.
 *
 * Products that have been retired or have sold out are skipped rather than
 * failing the merge — losing one unavailable line must not cost the shopper the
 * rest of their cart.
 */
export async function mergeGuestCart(userId, items) {
  // Collapse any duplicate lines the browser may be holding for one product.
  const wanted = new Map();
  for (const item of Array.isArray(items) ? items : []) {
    const productId = item?.productId;
    const quantity = Math.floor(Number(item?.quantity));
    if (!isValidProductId(productId)) continue;
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    wanted.set(productId, (wanted.get(productId) || 0) + quantity);
  }

  if (wanted.size === 0) return;

  const products = await prisma.product.findMany({
    where: { id: { in: [...wanted.keys()] }, isActive: true, stock: { gt: 0 } },
    select: { id: true, stock: true },
  });

  if (products.length === 0) return;

  const existing = await prisma.cartItem.findMany({
    where: { userId, productId: { in: products.map((p) => p.id) } },
    select: { productId: true, quantity: true },
  });
  const alreadyInCart = new Map(existing.map((row) => [row.productId, row.quantity]));

  await prisma.$transaction(
    products.map((product) => {
      const quantity = clampQuantity(
        (alreadyInCart.get(product.id) || 0) + wanted.get(product.id),
        product.stock
      );
      return prisma.cartItem.upsert({
        where: { userId_productId: { userId, productId: product.id } },
        create: { userId, productId: product.id, quantity, selected: true },
        // A line the account already had keeps its checkbox: the shopper
        // deliberately unticked it on another device, and a merge is not a
        // reason to overrule that.
        update: { quantity },
      });
    })
  );
}
