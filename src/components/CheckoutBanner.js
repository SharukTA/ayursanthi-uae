"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// CheckoutBanner — the ONLY admin-controlled element on the checkout page.
//
// The checkout layout (address → payment → review) is deliberately fixed in code
// for safety. The admin gets a single banner slot, managed in the Content
// Builder under the "Checkout" tab. We render the FIRST active CHECKOUT section
// as a slim trust/announcement strip; everything else there is ignored. Renders
// nothing if no checkout section is configured, so the page is unaffected by
// default.
// ─────────────────────────────────────────────────────────────────────────────
export function CheckoutBanner() {
  const [banner, setBanner] = useState(null);

  useEffect(() => {
    let active = true;
    fetch("/api/page-sections?placement=CHECKOUT")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active || !data) return;
        const section = (data.sections || [])[0];
        if (!section) return;
        // Pull copy from the section heading, falling back to its first item so
        // either way of filling it in the builder works.
        const item = (section.items || [])[0] || {};
        const heading = section.title || item.title || "";
        const sub = section.subtitle || item.body || item.subtitle || "";
        const href = item.href || "";
        const cta = item.badge || "";
        if (!heading && !sub) return;
        setBanner({ heading, sub, href, cta });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!banner) return null;

  const content = (
    <div className="flex items-center gap-3">
      <ShieldCheck className="size-5 shrink-0 text-emerald-700" />
      <div className="min-w-0">
        {banner.heading ? (
          <p className="text-sm font-bold text-emerald-900">{banner.heading}</p>
        ) : null}
        {banner.sub ? (
          <p className="truncate text-xs text-emerald-800/80">{banner.sub}</p>
        ) : null}
      </div>
      {banner.href ? (
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-bold text-emerald-700">
          {banner.cta || "Learn more"}
          <ArrowRight className="size-3.5" />
        </span>
      ) : null}
    </div>
  );

  return (
    <div className="border-t border-emerald-100 bg-emerald-50">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        {banner.href ? (
          <Link href={banner.href} className="block hover:opacity-90">
            {content}
          </Link>
        ) : (
          content
        )}
      </div>
    </div>
  );
}
