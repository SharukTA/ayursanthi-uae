import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const orderNumber = process.argv[2] || "AYUR-847274-9762";

const order = await prisma.order.findFirst({
  where: { orderNumber },
  include: { items: true, payments: true },
});

if (!order) {
  console.log(`No order found with number ${orderNumber}`);
} else {
  console.log("=== ORDER ===");
  console.log({
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    subtotal: String(order.subtotal),
    tax: String(order.tax),
    shipping: String(order.shipping),
    total: String(order.total),
    userId: order.userId,
  });
  console.log("=== ITEMS ===");
  for (const it of order.items) {
    console.log(`${it.productName} x${it.quantity} @ ${it.price} = ${it.total}`);
  }
  console.log("=== PAYMENT ===");
  for (const p of order.payments) {
    console.log({
      provider: p.provider,
      providerPaymentId: p.providerPaymentId,
      amount: String(p.amount),
      status: p.status,
    });
  }

  const pending = await prisma.pendingCheckout.findFirst({
    where: { orderId: order.id },
  });
  console.log("=== PENDING CHECKOUT ===");
  console.log(pending ? { status: pending.status, orderId: pending.orderId } : "none");

  console.log("=== CURRENT STOCK FOR PURCHASED PRODUCTS ===");
  for (const it of order.items) {
    const prod = await prisma.product.findUnique({ where: { id: it.productId } });
    console.log(`${it.productName}: stock now = ${prod?.stock}`);
  }

  const buyer = await prisma.user.findUnique({
    where: { id: order.userId },
    select: { referredById: true },
  });
  console.log("=== REFERRAL COMMISSION ===");
  console.log(buyer?.referredById ? `Buyer was referred by ${buyer.referredById}` : "Buyer has no referrer (no commission expected)");
}

await prisma.$disconnect();
