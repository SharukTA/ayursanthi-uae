import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import {
  ShopCodeForm,
  ShopDetailsCard,
  ShopLinkCard,
  ShopReferralCard,
  ShopWithdrawalCard,
  ShopSignOutButton,
} from "@/components/MyShopControls";
import { ShopProfitCard } from "@/components/ShopProfitCard";
import { ShopReport } from "@/components/ShopReport";
import { prisma } from "@/lib/prisma";
import { getShopReferralRate } from "@/lib/settings";
import { getCurrentShop, getShopReport } from "@/lib/shop";
import { readShopReportQuery } from "@/lib/shop-shared";

export const metadata = {
  title: "My Shop | Ayurshoppee",
  robots: { index: false, follow: false },
};

// Everything on this page is scoped to the shop in the signed-in partner's cookie.
// There is no shop id in the URL and no list to pick from, so there is nothing to
// change in order to see somebody else's figures. Without that cookie, the visitor
// gets a code box and no data at all.
export default async function MyShopPage({ searchParams }) {
  const shop = await getCurrentShop();

  if (!shop) {
    return (
      <main className="flex min-h-screen flex-col bg-slate-50 text-white">
        <SiteHeader />
        <section className="bg-slate-950 py-10 text-center text-white sm:py-14">
          <h1 className="text-3xl font-bold tracking-tight">View my shop</h1>
        </section>
        <section className="mx-auto w-full max-w-md flex-1 px-4 py-10">
          <div className="rounded-md border border-border bg-white p-6 shadow-sm">
            <ShopCodeForm />
          </div>
          <p className="mt-4 text-center text-sm text-slate-600">
            Don&apos;t have a shop yet?{" "}
            <Link href="/join-shop" className="font-semibold text-slate-900 underline">
              Join here
            </Link>
          </p>
          <p className="mt-2 text-center text-sm text-slate-600">
            Lost your code?{" "}
            <Link href="/contact" className="font-semibold text-slate-900 underline">
              Contact us
            </Link>
          </p>
        </section>
        <SiteFooter />
      </main>
    );
  }

  const query = readShopReportQuery(await searchParams);
  const [report, referralRate, products, pendingEmailChange] = await Promise.all([
    getShopReport(shop.id, query),
    getShopReferralRate(),
    prisma.product.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: { slug: true, name: true },
    }),
    prisma.shopEmailChange.findFirst({
      where: { shopId: shop.id, expiresAt: { gt: new Date() } },
      select: { newEmail: true },
    }),
  ]);
  const { profitTier } = report;

  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-white">
      <SiteHeader />
      <section className="bg-slate-950 py-8 text-white">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 sm:flex-row sm:items-end sm:justify-between sm:px-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">{shop.ownerName}&apos;s shop</h1>
            <p className="mt-2 text-sm text-slate-300">
              Your profit: <span className="font-bold text-white">{profitTier.rate}%</span> &middot;{" "}
              {profitTier.unitsSold} {profitTier.unitsSold === 1 ? "unit" : "units"} sold
            </p>
          </div>
          <ShopSignOutButton />
        </div>
      </section>
      <section className="mx-auto grid w-full max-w-5xl flex-1 gap-6 px-4 py-8 sm:px-6">
        <ShopProfitCard shopId={shop.id} profitTier={profitTier} />
        <ShopLinkCard linkCode={shop.linkCode} products={products} />
        <ShopReferralCard referralCode={shop.referralCode} referralRate={referralRate} />
        <ShopReport
          report={report}
          balanceAction={
            <ShopWithdrawalCard available={report.totals.balance} withdrawal={report.withdrawal} />
          }
        />
        <ShopDetailsCard
          ownerName={shop.ownerName}
          phone={shop.phone}
          email={shop.email}
          pendingEmail={pendingEmailChange?.newEmail ?? null}
        />
      </section>
      <SiteFooter />
    </main>
  );
}
