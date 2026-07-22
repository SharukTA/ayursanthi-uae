import { prisma } from "@/lib/prisma";

/**
 * Places a Cash-on-Delivery order.
 *
 * There is no payment gateway in the flow: the customer pays the courier on
 * delivery, so the order is created straight away and the money is collected
 * later. Everything is priced from DB values — the client only ever sends
 * product ids and quantities, never amounts.
 *
 * Stock is decremented and the order created in a single transaction, so two
 * concurrent checkouts can't oversell the same unit.
 *
 * @param {object} args
 * @param {string} args.userId           the buying customer
 * @param {Array<{productId: string, quantity: number}>} args.cart
 * @param {object} args.shippingAddress  validated address snapshot
 * @returns {Promise<{status: string, message?: string, order?: object}>}
 *   status: created | empty_cart | unavailable | out_of_stock
 */
export async function placeCodOrder({ userId, cart, shippingAddress }) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return { status: "empty_cart", message: "Your cart is empty." };
  }

  // Recompute every amount from DB prices — never trust what the client sent.
  let subtotal = 0;
  const items = [];
  for (const item of cart) {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { status: "unavailable", message: "Invalid quantity for one or more products." };
    }

    const product = await prisma.product.findUnique({ where: { id: item.productId } });
    if (!product || !product.isActive) {
      return { status: "unavailable", message: "One or more products are unavailable." };
    }
    if (product.stock < quantity) {
      return { status: "out_of_stock", message: `Insufficient stock for "${product.name}".` };
    }

    const price = Number(product.price);
    const lineTotal = parseFloat((price * quantity).toFixed(2));
    subtotal += lineTotal;
    items.push({
      productId: product.id,
      productName: product.name,
      quantity,
      price,
      total: lineTotal,
    });
  }

  subtotal = parseFloat(subtotal.toFixed(2));
  const tax = parseFloat((subtotal * 0.18).toFixed(2));
  const shipping = subtotal >= 1000 ? 0.0 : 99.0;
  const total = parseFloat((subtotal + tax + shipping).toFixed(2));

  const order = await prisma.$transaction(async (tx) => {
    // Re-read stock inside the transaction so a concurrent checkout that drained
    // the last unit between the loop above and here still fails cleanly.
    for (const it of items) {
      const product = await tx.product.findUnique({ where: { id: it.productId } });
      if (!product) throw new Error("Product not found.");
      if (product.stock < it.quantity) {
        throw new Error(`Insufficient stock for "${it.productName}".`);
      }
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: it.quantity } },
      });
    }

    const orderNumber = `AYUR-${Date.now().toString().slice(-6)}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const created = await tx.order.create({
      data: {
        orderNumber,
        userId,
        // COD: the order is real, but nothing is collected until delivery.
        status: "PENDING",
        paymentStatus: "PENDING",
        subtotal,
        tax,
        shipping,
        total,
        addressSnapshot: shippingAddress,
        items: {
          create: items.map((it) => ({
            productId: it.productId,
            productName: it.productName,
            quantity: it.quantity,
            price: it.price,
            total: it.total,
          })),
        },
        payments: {
          create: {
            provider: "cod",
            amount: total,
            status: "PENDING",
            rawResponse: {
              method: "cash_on_delivery",
              placedAt: new Date().toISOString(),
            },
          },
        },
      },
    });

    // Clear only what was actually bought — a "Buy Now" checkout must leave the
    // rest of the server-side cart alone.
    await tx.cartItem.deleteMany({
      where: { userId, productId: { in: items.map((it) => it.productId) } },
    });

    return created;
  });

  return { status: "created", order };
}
