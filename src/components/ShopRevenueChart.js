import { formatAmount, formatMoney } from "@/lib/currency";

// Set inline because globals.css remaps Tailwind's colour families. Checked with the
// dataviz palette validator: the brand teal #156c6b reads as gray in a thin bar.
const BAR_COLOR = "#00908a";
const GRID_COLOR = "#e5e7eb";

// How many days or months the axis can name before its labels would run together.
const MAX_AXIS_LABELS = 7;
const DENSE_CHART_BARS = 12;
// How high a tooltip can start and still fit inside the plot, over the tallest bars.
const TOOLTIP_MAX_BOTTOM = 72;

/** A round number at or above `value`, so the axis reads 0 / 500 / 1,000. */
function niceCeiling(value) {
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((candidate) => candidate * magnitude >= value);
  return step * magnitude;
}

function axisValue(value) {
  return value >= 10000 ? `${formatAmount(value / 1000, { decimals: 0 })}K` : formatAmount(value, { decimals: 0 });
}

// A tooltip is much wider than a bar, so near the edges it hangs inwards to stay on the
// page.
function tooltipAnchor(index, count) {
  if (index < count / 4) return "left-0";
  if (index >= (count * 3) / 4) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

// An axis label is centred under its bar. Only on a dense chart, where a column is
// narrower than its label, do the outermost ones hang inwards.
function axisLabelAnchor(index, count) {
  if (count > DENSE_CHART_BARS && index === 0) return "left-0";
  if (count > DENSE_CHART_BARS && index === count - 1) return "right-0";
  return "left-1/2 -translate-x-1/2";
}

/**
 * Revenue over the chosen period, as one bar per hour, day or month. Plain markup and
 * CSS, so it renders the same on the partner's server page and in the admin console.
 *
 * @param {object} props
 * @param {Array<{key: string, label: string, longLabel: string, value: number}>} props.buckets
 */
export function ShopRevenueChart({ buckets }) {
  const highest = Math.max(...buckets.map((bucket) => bucket.value));
  const withSales = buckets.filter((bucket) => bucket.value > 0);

  if (withSales.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">No sales in this period.</p>;
  }

  const ceiling = niceCeiling(highest);
  const labelEvery = Math.ceil(buckets.length / MAX_AXIS_LABELS);

  return (
    <>
      <div className="mt-4 flex gap-2">
        {/* The value axis. Labels sit on their gridlines, so it shares the plot's height. */}
        <div aria-hidden="true" className="relative h-44 w-10 shrink-0 text-right text-[11px] text-slate-500">
          {[1, 0.5, 0].map((share) => (
            <span
              key={share}
              className="absolute right-0 -translate-y-1/2"
              style={{ top: `${(1 - share) * 100}%` }}
            >
              {axisValue(ceiling * share)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative h-44" style={{ borderBottom: `1px solid ${GRID_COLOR}` }}>
            {[0, 0.5].map((position) => (
              <span
                key={position}
                aria-hidden="true"
                className="absolute inset-x-0"
                style={{ top: `${position * 100}%`, borderTop: `1px solid ${GRID_COLOR}` }}
              />
            ))}
            <div className="absolute inset-0 flex items-stretch">
              {buckets.map((bucket, index) => (
                // The whole column is the hover target, not just the painted bar, so
                // a short bar is as easy to reach as a tall one.
                <div
                  key={bucket.key}
                  tabIndex={bucket.value > 0 ? 0 : undefined}
                  aria-label={bucket.value > 0 ? `${bucket.longLabel}: ${formatMoney(bucket.value)}` : undefined}
                  className="group relative flex min-w-0 flex-1 items-end justify-center px-px outline-none"
                >
                  {bucket.value > 0 ? (
                    <>
                      <span
                        aria-hidden="true"
                        className="block w-full max-w-6 rounded-t transition-opacity group-hover:opacity-75 group-focus:opacity-75"
                        style={{
                          height: `${(bucket.value / ceiling) * 100}%`,
                          minHeight: "2px",
                          backgroundColor: BAR_COLOR,
                        }}
                      />
                      <span
                        role="tooltip"
                        className={`pointer-events-none absolute z-20 mb-1 hidden whitespace-nowrap rounded border px-2 py-1 text-xs shadow-md group-hover:block group-focus:block ${tooltipAnchor(index, buckets.length)}`}
                        style={{
                          bottom: `${Math.min((bucket.value / ceiling) * 100, TOOLTIP_MAX_BOTTOM)}%`,
                          backgroundColor: "#ffffff",
                          borderColor: GRID_COLOR,
                          color: "#0f1111",
                        }}
                      >
                        <span className="block font-bold">{formatMoney(bucket.value)}</span>
                        <span className="block" style={{ color: "#565959" }}>
                          {bucket.longLabel}
                        </span>
                      </span>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div aria-hidden="true" className="relative mt-1 flex h-4 text-[11px] text-slate-500">
            {buckets.map((bucket, index) => (
              <span key={bucket.key} className="relative min-w-0 flex-1">
                {index % labelEvery === 0 ? (
                  <span className={`absolute top-0 whitespace-nowrap ${axisLabelAnchor(index, buckets.length)}`}>
                    {bucket.label}
                  </span>
                ) : null}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* The same values without hovering, for touch screens and screen readers. */}
      <details className="mt-3 text-xs text-slate-600">
        <summary className="cursor-pointer font-semibold">View as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {withSales.map((bucket) => (
              <tr key={bucket.key} className="border-t border-slate-100">
                <th scope="row" className="py-1 text-left font-normal">
                  {bucket.longLabel}
                </th>
                <td className="py-1 text-right font-semibold text-slate-900">{formatMoney(bucket.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
