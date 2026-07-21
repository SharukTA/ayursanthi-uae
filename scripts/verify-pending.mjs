import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Overview of every checkout attempt and whether it became an order.
const pendings = await prisma.pendingCheckout.findMany({
  orderBy: { createdAt: "desc" },
  take: 20,
});

console.log(`=== PENDING CHECKOUTS (latest ${pendings.length}) ===`);
for (const p of pendings) {
  console.log({
    razorpayOrderId: p.razorpayOrderId,
    status: p.status,
    total: String(p.total),
    orderId: p.orderId || "(none)",
    failureReason: p.failureReason || "",
  });
}

// Group counts by status.
const byStatus = pendings.reduce((acc, p) => {
  acc[p.status] = (acc[p.status] || 0) + 1;
  return acc;
}, {});
console.log("=== COUNTS BY STATUS ===");
console.log(byStatus);

// Safety assertion: no PENDING/FAILED checkout should have created an order.
const leaked = pendings.filter((p) => p.status !== "COMPLETED" && p.orderId);
console.log("=== INTEGRITY CHECK ===");
console.log(
  leaked.length === 0
    ? "OK: no non-completed checkout has an order attached."
    : `PROBLEM: ${leaked.length} non-completed checkout(s) created an order!`
);

await prisma.$disconnect();
