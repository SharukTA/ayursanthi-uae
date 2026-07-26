import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { 
  Users, 
  ShoppingBag, 
  IndianRupee, 
  FolderTree, 
  ArrowRight,
  TrendingUp,
  Package,
  ShieldCheck,
  CheckCircle2,
  Clock,
  LayoutTemplate,
  RotateCcw,
  Settings,
  FileText
} from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Admin Dashboard | Ayursanthi",
  description: "Administrative console for managing Ayursanthi store products, orders, and users.",
};

export default async function AdminDashboardPage() {
  // 1. Session Guard
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/login");
  }

  // 2. Aggregate metrics from Prisma
  const revenueAggregate = await prisma.order.aggregate({
    _sum: { total: true },
    where: { paymentStatus: "PAID" },
  });
  const totalRevenue = Number(revenueAggregate._sum.total || 0);

  const totalOrders = await prisma.order.count();
  const totalProducts = await prisma.product.count();
  const totalUsers = await prisma.user.count();

  // 3. Query recent orders
  const recentOrders = await prisma.order.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { name: true, email: true },
      },
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      {/* Admin Title Banner */}
      <section className="bg-slate-950 py-8 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <PageReveal>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-white/15 border border-white/30 px-2.5 py-1 text-xs font-bold text-white">
              <ShieldCheck className="size-3.5" />
              Administrative Control
            </span>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">
              Console Dashboard
            </h1>
          </PageReveal>

          {/* Quick Panel Navigation */}
          <div className="flex flex-wrap gap-2 text-xs">
            <Button asChild variant="secondary" className="bg-white border-2 border-white text-[#0f1111] hover:bg-[#f8fafc] shadow-lg shadow-black/30 h-9 rounded font-bold">
              <Link href="/admin/home">Home Builder</Link>
            </Button>
            <Button asChild variant="secondary" className="bg-white border-2 border-white text-[#0f1111] hover:bg-[#f8fafc] shadow-lg shadow-black/30 h-9 rounded font-bold">
              <Link href="/admin/orders">Orders</Link>
            </Button>
            <Button asChild variant="secondary" className="bg-white border-2 border-white text-[#0f1111] hover:bg-[#f8fafc] shadow-lg shadow-black/30 h-9 rounded font-bold">
              <Link href="/admin/returns">Returns</Link>
            </Button>
            <Button asChild variant="secondary" className="bg-white border-2 border-white text-[#0f1111] hover:bg-[#f8fafc] shadow-lg shadow-black/30 h-9 rounded font-bold">
              <Link href="/admin/categories">Categories Portal</Link>
            </Button>
            <Button asChild variant="secondary" className="bg-white border-2 border-white text-[#0f1111] hover:bg-[#f8fafc] shadow-lg shadow-black/30 h-9 rounded font-bold">
              <Link href="/admin/products">Inventory Portal</Link>
            </Button>
            <Button asChild variant="secondary" className="bg-white border-2 border-white text-[#0f1111] hover:bg-[#f8fafc] shadow-lg shadow-black/30 h-9 rounded font-bold">
              <Link href="/admin/pages">Pages &amp; FAQ</Link>
            </Button>
            <Button asChild variant="secondary" className="bg-white border-2 border-white text-[#0f1111] hover:bg-[#f8fafc] shadow-lg shadow-black/30 h-9 rounded font-bold">
              <Link href="/admin/settings">Settings</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Main Stats Panel */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 flex-1 w-full">
        <Stagger className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Revenue", value: `Rs. ${totalRevenue.toLocaleString()}`, icon: IndianRupee, tone: "text-emerald-700 bg-emerald-100/55 border-emerald-200" },
            { label: "Total Orders", value: totalOrders, icon: ShoppingBag, tone: "text-indigo-750 bg-indigo-100/55 border-indigo-250" },
            { label: "Total Products", value: totalProducts, icon: Package, tone: "text-amber-800 bg-amber-100/55 border-amber-250" },
            { label: "Registered Users", value: totalUsers, icon: Users, tone: "text-rose-800 bg-rose-100/55 border-rose-250" }
          ].map((stat, i) => {
            const Icon = stat.icon;
            return (
              <StaggerItem key={i}>
                <div className={`rounded-md border p-6 bg-white shadow-sm flex items-center justify-between ${stat.tone.split(" ").slice(-1)[0]}`}>
                  <div>
                    <p className="text-xs font-bold text-slate-450 uppercase tracking-wide">{stat.label}</p>
                    <p className="mt-2 text-2xl font-extrabold text-slate-950">{stat.value}</p>
                  </div>
                  <span className={`flex size-12 items-center justify-center rounded-md ${stat.tone.split(" ").slice(0, 2).join(" ")}`}>
                    <Icon className="size-6" />
                  </span>
                </div>
              </StaggerItem>
            );
          })}
        </Stagger>

        {/* Dashboard Panels */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          
          {/* Left panel: Recent Orders */}
          <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-base font-bold text-slate-950 flex items-center gap-2">
                <Clock className="size-5 text-emerald-700" />
                Recent Orders
              </h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Latest transactions
              </span>
            </div>

            <div className="mt-6 overflow-x-auto">
              {recentOrders.length === 0 ? (
                <p className="text-sm text-slate-500 italic text-center py-10">No orders placed yet.</p>
              ) : (
                <table className="w-full text-left text-xs font-medium text-slate-650 divide-y divide-slate-100">
                  <thead>
                    <tr className="text-slate-450 uppercase font-bold tracking-wider">
                      <th className="pb-3">Invoice</th>
                      <th className="pb-3">Customer</th>
                      <th className="pb-3">Total Amount</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {recentOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-50/50">
                        <td className="py-3.5 font-mono text-emerald-800 font-bold">{ord.orderNumber}</td>
                        <td className="py-3.5">
                          <p className="font-bold text-slate-900">{ord.user.name}</p>
                          <p className="text-[10px] text-slate-400">{ord.user.email}</p>
                        </td>
                        <td className="py-3.5 font-extrabold text-slate-900">Rs. {Number(ord.total).toLocaleString()}</td>
                        <td className="py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[9px] font-bold ${
                            ord.status === "DELIVERED" 
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200" 
                              : "bg-amber-50 text-amber-900 border border-amber-200"
                          }`}>
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-[10px] text-slate-450">
                          {new Date(ord.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </FadeIn>

          {/* Right panel: Portal Links */}
          <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm flex flex-col gap-6">
            <div>
              <h2 className="text-base font-bold text-slate-950 flex items-center gap-2 border-b border-slate-100 pb-4">
                <TrendingUp className="size-5 text-emerald-700" />
                Quick Management Actions
              </h2>
            </div>

            <div className="grid gap-4 flex-1">
              {[
                {
                  title: "Order Management",
                  desc: "View all orders and update fulfillment status (Confirmed → Processing → Shipped → Delivered). Customers see changes instantly.",
                  href: "/admin/orders",
                  icon: ShoppingBag,
                  color: "bg-blue-100 text-blue-800"
                },
                {
                  title: "Returns & Refunds",
                  desc: "Work the return queue: approve requests, confirm the item is back (stock returns automatically), then refund or send a replacement.",
                  href: "/admin/returns",
                  icon: RotateCcw,
                  color: "bg-rose-100 text-rose-800"
                },
                {
                  title: "Home Builder",
                  desc: "Compose the public homepage: add, reorder, and fill video, deal, category, product, promo, and review blocks.",
                  href: "/admin/home",
                  icon: LayoutTemplate,
                  color: "bg-teal-100 text-teal-800"
                },
                {
                  title: "Category Portal",
                  desc: "Add collections, configure subcategories, and customize image themes.", 
                  href: "/admin/categories", 
                  icon: FolderTree,
                  color: "bg-emerald-100 text-emerald-800"
                },
                {
                  title: "Inventory Portal",
                  desc: "Create products, customize prices/MRP, and monitor stock depletion levels.",
                  href: "/admin/products",
                  icon: Package,
                  color: "bg-indigo-150 text-indigo-850"
                },
                {
                  title: "Pages & FAQ",
                  desc: "Edit the About and Terms page text, and manage the frequently asked questions list.",
                  href: "/admin/pages",
                  icon: FileText,
                  color: "bg-sky-100 text-sky-800"
                },
                {
                  title: "Site Settings",
                  desc: "Edit contact details and social links shown on the Contact page and footer.",
                  href: "/admin/settings",
                  icon: Settings,
                  color: "bg-amber-100 text-amber-800"
                }
              ].map((portal, index) => {
                const Icon = portal.icon;
                return (
                  <Link 
                    key={index} 
                    href={portal.href}
                    className="flex items-start gap-4 p-4 rounded-md border border-border hover:border-emerald-700 transition group hover:shadow-sm"
                  >
                    <span className={`flex size-10 items-center justify-center rounded-md shrink-0 ${portal.color}`}>
                      <Icon className="size-5" />
                    </span>
                    <div className="flex-1">
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-emerald-850 transition flex items-center justify-between">
                        {portal.title}
                        <ArrowRight className="size-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </h4>
                      <p className="mt-1 text-[11px] leading-5 text-slate-500">{portal.desc}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </FadeIn>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
