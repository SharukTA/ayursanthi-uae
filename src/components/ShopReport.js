import Link from "next/link";
import { ShopRevenueChart } from "@/components/ShopRevenueChart";
import { formatMoney } from "@/lib/currency";
import { SHOP_REPORT_RANGES, shopReportQueryString } from "@/lib/shop-shared";

const SALE_STATUS = {
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-900 border-amber-200" },
  SETTLED: { label: "Earned", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  CANCELLED: { label: "Cancelled", className: "bg-rose-50 text-rose-800 border-rose-200" },
  REFUNDED: { label: "Refunded", className: "bg-rose-50 text-rose-800 border-rose-200" },
  DISPUTED: { label: "Disputed", className: "bg-rose-50 text-rose-800 border-rose-200" },
};

// Fixed to the store's zone so the server and browser print the same date.
function formatDate(value) {
  return new Date(value).toLocaleDateString("en-AE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Dubai",
  });
}

function availableHint(totals, withdrawal) {
  if (totals.balance < 0) return "Refunded or disputed after being paid. New profit covers this first.";
  if (withdrawal.canWithdraw) return "Ready to withdraw";
  if (withdrawal.minimum > 0) return `You can withdraw from ${formatMoney(withdrawal.minimum)}`;
  return "Earned and not yet paid";
}

function Stat({ label, value, hint, className = "" }) {
  return (
    <div className={`rounded-md border border-border bg-white p-4 shadow-sm ${className}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 text-xl font-extrabold text-slate-950">{value}</p>
      {hint ? <p className="mt-1 text-[11px] leading-4 text-slate-500">{hint}</p> : null}
    </div>
  );
}

// A link on the partner's page, which is rendered on the server and reads its period
// from the URL, and a button in the admin console, which loads the report itself.
function ReportControl({ query, onNavigate, children, ...props }) {
  if (onNavigate) {
    return (
      <button type="button" onClick={() => onNavigate(query)} {...props}>
        {children}
      </button>
    );
  }
  return (
    <Link href={`/my-shop${shopReportQueryString(query)}`} scroll={false} prefetch={false} {...props}>
      {children}
    </Link>
  );
}

function Pager({ pageInfo, queryFor, onNavigate }) {
  if (pageInfo.pageCount <= 1) return null;
  const control = "font-semibold text-slate-900 underline underline-offset-2";
  return (
    <nav className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-600">
      {pageInfo.page > 1 ? (
        <ReportControl query={queryFor(pageInfo.page - 1)} onNavigate={onNavigate} className={control}>
          Previous
        </ReportControl>
      ) : (
        <span />
      )}
      <span>
        Page {pageInfo.page} of {pageInfo.pageCount} &middot; {pageInfo.total} in all
      </span>
      {pageInfo.page < pageInfo.pageCount ? (
        <ReportControl query={queryFor(pageInfo.page + 1)} onNavigate={onNavigate} className={control}>
          Next
        </ReportControl>
      ) : (
        <span />
      )}
    </nav>
  );
}

/**
 * The figures for one shop. Plain markup with no state, because both the partner's
 * page (a server component) and the admin console (a client one) render it.
 *
 * @param {object} props
 * @param {object} props.report  from getShopReport in lib/shop.js
 * @param {(payout: object) => void} [props.onRemovePayout]  admin only
 * @param {(query: object) => void} [props.onNavigate]  admin only: see ReportControl
 * @param {React.ReactNode} [props.balanceAction]  shown under the balance
 */
export function ShopReport({ report, onRemovePayout, onNavigate, balanceAction }) {
  const {
    range,
    totals,
    withdrawal,
    period,
    revenueChart,
    unitsSold,
    products,
    sales,
    salesPage,
    payouts,
    referredShopNames,
    referralEarnings,
    referralsPage,
  } = report;
  const rangeLabel = SHOP_REPORT_RANGES.find((entry) => entry.key === range)?.label ?? "";
  const query = { range, page: salesPage.page, referralPage: referralsPage.page };

  return (
    <div className="grid gap-6">
      <section>
        <h2 className="mb-3 text-base font-bold text-slate-950">Your balance</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Available" value={formatMoney(totals.balance)} hint={availableHint(totals, withdrawal)} />
          <Stat
            label="Pending"
            value={formatMoney(totals.pending)}
            hint="Orders that can still be cancelled"
          />
          <Stat label="Paid out" value={formatMoney(totals.paidOut)} />
          <Stat
            label="Total profit"
            value={formatMoney(totals.commission)}
            hint={
              totals.referralProfit > 0
                ? `All time, including ${formatMoney(totals.referralProfit)} referral profit`
                : "All time"
            }
          />
        </div>
        {balanceAction}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-950">Sales report</h2>
          <div className="flex flex-wrap gap-1.5">
            {SHOP_REPORT_RANGES.map((entry) => {
              const active = entry.key === range;
              return (
                <ReportControl
                  key={entry.key}
                  query={{ range: entry.key, page: 1, referralPage: 1 }}
                  onNavigate={onNavigate}
                  aria-current={active ? "true" : undefined}
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  // Inline because globals.css overrides these colours on the white page.
                  style={
                    active
                      ? { backgroundColor: "#232f3e", borderColor: "#232f3e", color: "#ffffff" }
                      : { backgroundColor: "#ffffff", borderColor: "#d5d9d9", color: "#0f1111" }
                  }
                >
                  {entry.label}
                </ReportControl>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          <Stat
            label="Revenue"
            className="col-span-2 lg:col-span-1"
            value={formatMoney(period.sales)}
            hint={`${period.orders} ${period.orders === 1 ? "order" : "orders"}, delivery not included`}
          />
          <Stat label="Stock sold" value={unitsSold} hint="Units bought through this shop" />
          <Stat
            label="Profit"
            value={formatMoney(period.profit)}
            hint={
              period.referralProfit > 0
                ? `Including ${formatMoney(period.referralProfit)} referral profit`
                : undefined
            }
          />
        </div>
      </section>

      <section className="rounded-md border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">Revenue (AED)</h2>
        <p className="mt-0.5 text-xs text-slate-500">{rangeLabel}, delivery not included</p>
        <ShopRevenueChart buckets={revenueChart} />
      </section>

      <section className="rounded-md border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">Stock sold</h2>
        {products.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Nothing sold in this period.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {products.map((product) => (
              <li key={product.name} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 font-semibold text-slate-900">{product.name}</span>
                <span className="shrink-0 text-right text-slate-600">
                  {product.units} {product.units === 1 ? "unit" : "units"} &middot;{" "}
                  {formatMoney(product.value)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-md border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">Sales</h2>
        {sales.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No sales in this period.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {sales.map((sale) => {
              const status = SALE_STATUS[sale.status];
              return (
                <li key={sale.id} className="py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-slate-700">{sale.orderNumber}</span>
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 text-slate-800">
                    {sale.items.map((item) => `${item.name} x ${item.quantity}`).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatDate(sale.date)} &middot; {formatMoney(sale.value)} &middot; {sale.rate}%
                    profit:{" "}
                    <span className="font-bold text-slate-900">{formatMoney(sale.commission)}</span>
                    {sale.partlyRefunded ? " · part refunded" : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <Pager
          pageInfo={salesPage}
          queryFor={(page) => ({ ...query, page })}
          onNavigate={onNavigate}
        />
      </section>

      {referredShopNames.length > 0 && !referralEarnings ? (
        <section className="rounded-md border border-border bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-950">Your referrals</h2>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
            Profit from referrals
          </p>
          <p className="mt-1.5 text-xl font-extrabold text-slate-950">
            {formatMoney(totals.referralProfit)}
          </p>
          <p className="mt-1 text-[11px] leading-4 text-slate-500">
            {range === "all"
              ? "All time, including orders that can still be cancelled"
              : `All time, including orders that can still be cancelled · ${rangeLabel}: ${formatMoney(period.referralProfit)}`}
          </p>
          <ul className="mt-3 divide-y divide-slate-100 border-t border-slate-100">
            {referredShopNames.map((name, index) => (
              <li key={index} className="py-2.5 text-sm font-semibold text-slate-900">
                {name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* The admin console only: see getShopReport. */}
      {referredShopNames.length > 0 && referralEarnings ? (
        <section className="rounded-md border border-border bg-white p-5 shadow-sm">
          <h2 className="text-base font-bold text-slate-950">Referral profit</h2>
          <p className="mt-1 text-[13px] text-slate-600">
            {`${referredShopNames.length} ${referredShopNames.length === 1 ? "shop" : "shops"} joined with this referral code · ${formatMoney(period.referralProfit)} earned in this period`}
          </p>
          {referralEarnings.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No purchases in this period.</p>
          ) : (
            <ul className="mt-3 divide-y divide-slate-100">
              {referralEarnings.map((earning) => {
                const status = SALE_STATUS[earning.status];
                return (
                  <li key={earning.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="font-semibold text-slate-900">{earning.shop}</span>
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {formatDate(earning.date)} &middot; {earning.rate}% profit:{" "}
                        <span className="font-bold text-slate-900">{formatMoney(earning.commission)}</span>
                        {earning.partlyRefunded ? " · part refunded" : ""}
                      </span>
                    </span>
                    <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${status.className}`}>
                      {status.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Pager
            pageInfo={referralsPage}
            queryFor={(referralPage) => ({ ...query, referralPage })}
            onNavigate={onNavigate}
          />
        </section>
      ) : null}

      <section className="rounded-md border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-bold text-slate-950">Payments</h2>
        {payouts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No payments yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {payouts.map((payout) => (
              <li key={payout.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="min-w-0 text-slate-700">
                  {formatDate(payout.date)}
                  {payout.note ? ` · ${payout.note}` : ""}
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="font-bold text-slate-900">{formatMoney(payout.amount)}</span>
                  {onRemovePayout ? (
                    <button
                      type="button"
                      onClick={() => onRemovePayout(payout)}
                      className="text-xs font-semibold text-rose-700 hover:underline"
                    >
                      Remove
                    </button>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
