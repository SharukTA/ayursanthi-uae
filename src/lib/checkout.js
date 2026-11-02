import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/pricing";
import { getFreeShippingThreshold } from "@/lib/settings";
import { getTermsVersion } from "@/lib/pages";
import { commissionOn } from "@/lib/shop";

/**
 * Creates an order and reserves its stock.
 *
 * Online payment is the only way to pay, so an order written here is never a
 * completed sale — it is a reservation. Stock is held, but nothing is confirmed
 * and no cart is emptied until the money actually lands on Stripe's hosted page
 * (lib/order-payment.js finishes the job, or releases the reservation).
 *
 * Reserving stock before payment is deliberate. The alternative — create the
 * order only once Stripe reports success — lets two shoppers pay for the same
 * last unit, and refunding one of them afterwards is a far worse outcome than
 * holding a unit for the few minutes a checkout session lives.
 *
 * Everything is priced from DB values — the client only ever sends product ids
 * and quantities, never amounts.
 *
 * Stock is decremented and the order created in a single transaction, so two
 * concurrent checkouts can't oversell the same unit.
 *
 * @param {object} args
 * @param {string} args.userId           the buying customer
 * @param {Array<{productId: string, quantity: number}>} args.cart
 * @param {object} args.shippingAddress  validated address snapshot
 * @param {boolean} [args.clearAccountCart=true]  whether this purchase came out
 *   of the saved account cart, and should therefore empty the lines it bought.
 *   False for a Buy Now, and for a basket built in the browser while signed out
 *   — those are separate lists, and the saved cart must survive them untouched.
 *   The emptying is always deferred rather than done here: the intent is
 *   recorded on the payment row and acted on once the money arrives.
 * @param {"account"|"guest"|"buynow"} [args.cartSource="account"]  which list the
 *   shopper checked out. Recorded because the browser-side baskets are tidied on
 *   the return page, long after the state that knew this was thrown away by the
 *   redirect to Stripe — and each list needs different treatment.
 * @param {{id: string, commissionRate: object, referrer: object|null}|null} [args.shop]
 *   the partner shop this purchase came through, from resolveAttributedShop in
 *   lib/shop.js.
 * @returns {Promise<{status: string, message?: string, order?: object}>}
 *   status: created | empty_cart | unavailable | out_of_stock
 */
export async function placeOrder({
  userId,
  cart,
  shippingAddress,
  clearAccountCart = true,
  cartSource = "account",
  shop = null,
}) {
  if (!Array.isArray(cart) || cart.length === 0) {
    return { status: "empty_cart", message: "Your cart is empty." };
  }

  // One read for the whole basket rather than one per line. Everything priced
  // below comes out of these rows, and reading them together also means the
  // basket is priced from a single point in time instead of from N reads spread
  // across however long the round trips take.
  //
  // Only the columns actually used are selected: a product row carries the
  // description and the rest of the listing copy, none of which is wanted here.
  const productIds = [
    ...new Set(cart.map((item) => item.productId).filter((id) => typeof id === "string" && id)),
  ];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, price: true, shippingFee: true, stock: true, isActive: true },
  });
  const productById = new Map(products.map((product) => [product.id, product]));

  // Recompute every amount from DB prices — never trust what the client sent.
  // Prices are tax-inclusive and final, so there is nothing to add on top of
  // the goods but delivery. See lib/pricing.js.
  let subtotal = 0;
  let shippingRaw = 0;
  const items = [];
  for (const item of cart) {
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { status: "unavailable", message: "Invalid quantity for one or more products." };
    }

    const product = productById.get(item.productId);
    if (!product || !product.isActive) {
      return { status: "unavailable", message: "One or more products are unavailable." };
    }
    if (product.stock < quantity) {
      return { status: "out_of_stock", message: `Insufficient stock for "${product.name}".` };
    }

    const price = Number(product.price);
    const lineTotal = round2(price * quantity);

    subtotal = round2(subtotal + lineTotal);
    // Per-product delivery fee, charged once per line (not per unit).
    shippingRaw = round2(shippingRaw + Number(product.shippingFee ?? 0));

    items.push({
      productId: product.id,
      productName: product.name,
      quantity,
      price,
      total: lineTotal,
    });
  }

  // Delivery is waived once the goods subtotal clears the admin-set free-shipping
  // bar (defaults to FREE_SHIPPING_THRESHOLD when unset — see lib/settings.js).
  const freeShippingThreshold = await getFreeShippingThreshold();
  const shipping = subtotal >= freeShippingThreshold ? 0 : round2(shippingRaw);
  const total = round2(subtotal + shipping);

  // Read outside the transaction: it is an independent lookup, and keeping it
  // out means it cannot lengthen the window in which stock rows are locked.
  const termsVersion = await getTermsVersion();

  const order = await prisma.$transaction(async (tx) => {
    // Reserve the stock with a conditional decrement — one statement per line,
    // rather than a re-read followed by an unconditional update.
    //
    // The two are not equivalent, and only this one actually holds. Under
    // Postgres' default READ COMMITTED isolation a plain SELECT takes no lock,
    // so two checkouts for the same last unit can both read stock 1, both pass
    // the check, and both then decrement — leaving the row at -1, which is the
    // precise oversell this transaction exists to prevent. Folding the condition
    // into the UPDATE closes it: the second writer blocks on the first one's row
    // lock and, once that commits, re-evaluates its WHERE against the new row
    // version, finds `stock >= quantity` no longer true, and matches nothing.
    //
    // A count of zero therefore means somebody else took the units while we were
    // here — the same outcome the old read-then-check reported, but now actually
    // guaranteed. It also covers a basket that lists one product on two lines:
    // the second decrement is measured against the stock the first one left.
    for (const it of items) {
      const reserved = await tx.product.updateMany({
        where: { id: it.productId, stock: { gte: it.quantity } },
        data: { stock: { decrement: it.quantity } },
      });
      if (reserved.count === 0) {
        throw new Error(`Insufficient stock for "${it.productName}".`);
      }
    }

    const orderNumber = `AYUR-${Date.now().toString().slice(-6)}-${Math.floor(
      1000 + Math.random() * 9000
    )}`;

    const created = await tx.order.create({
      data: {
        orderNumber,
        userId,
        // Every order starts PENDING/PENDING and moves to CONFIRMED/PAID the
        // moment the webhook (or the return page) confirms the charge. One that
        // never gets there is released, not fulfilled.
        status: "PENDING",
        paymentStatus: "PENDING",
        subtotal,
        shipping,
        total,
        // The conditions of use in force on the day of the purchase — what the
        // notice under the place-order button pointed at.
        termsVersion,
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
            provider: "stripe",
            amount: total,
            status: "PENDING",
            rawResponse: {
              method: "stripe_checkout",
              placedAt: new Date().toISOString(),
              // Read back once the money lands: the cart cannot be emptied here,
              // because an abandoned payment must leave the shopper's basket
              // exactly as they left it. clearAccountCart is acted on server-side
              // by lib/order-payment.js; cartSource is read by the return page,
              // which is where the browser's own baskets get tidied.
              clearAccountCart,
              cartSource,
            },
          },
        },
        // On the goods only, never the delivery. Written now and counted only once
        // the order is paid: see COUNTED_ORDER in lib/shop.js.
        ...(shop
          ? {
              shopSale: {
                create: {
                  shopId: shop.id,
                  rate: shop.commissionRate,
                  goodsTotal: subtotal,
                  commission: commissionOn(subtotal, shop.commissionRate),
                  ...(shop.referrer
                    ? {
                        referrerShopId: shop.referrer.shopId,
                        referrerRate: shop.referrer.rate,
                        referrerCommission: commissionOn(subtotal, shop.referrer.rate),
                      }
                    : {}),
                },
              },
            }
          : {}),
      },
    });

    return created;
  });

  return { status: "created", order };
}

