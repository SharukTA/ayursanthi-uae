import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Amazon/Flipkart-style breadcrumb trail (Home › Category › Product). Pure
// server component — pass an ordered `items` array; the last item renders as the
// current (non-linked) page. Kept compact and muted so it sits quietly above the
// page title.
export function Breadcrumbs({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      <ol className="flex flex-wrap items-center gap-1 text-xs font-medium text-[#565959]">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <li key={`${item.label}-${i}`} className="flex items-center gap-1">
              {isLast || !item.href ? (
                <span className={isLast ? "font-semibold text-[#0f1111]" : ""} aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              ) : (
                <Link href={item.href} className="transition hover:text-emerald-700 hover:underline">
                  {item.label}
                </Link>
              )}
              {!isLast ? <ChevronRight className="size-3 text-[#adb1b8]" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
