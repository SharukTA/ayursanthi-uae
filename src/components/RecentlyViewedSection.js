"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { FeaturedCarousel } from "@/components/FeaturedCarousel";
import { SectionHeader, SECTION_SHELL } from "@/components/SectionHeader";
import { useSession } from "@/components/SessionProvider";
import { clearRecentlyViewed, readRecentlyViewed } from "@/lib/recently-viewed";

// ── RECENTLY_VIEWED ("Continue shopping") ────────────────────────────────────
//
// The one section type that renders in the browser rather than on the server.
// Every page that hosts CMS blocks is ISR-cached and shared by all visitors, so
// a personalised strip cannot be server-rendered — see lib/recently-viewed.js.
//
// Consequences that shape this component:
//   • It renders null until the fetch resolves, so the server HTML and the first
//     client render agree (no hydration mismatch) and no layout jumps in for a
//     visitor with no history.
//   • A shopper with an empty history, or whose viewed products have all been
//     retired, sees nothing at all — never a padded or generic fallback, which
//     would make the "Continue shopping" heading a lie.
export function RecentlyViewedSection({ section }) {
  const pathname = usePathname();
  const { session } = useSession();
  const userId = session?.userId ?? null;
  const [items, setItems] = useState([]);

  useEffect(() => {
    // Abort on unmount so a slow response can't set state on a dead component
    // (e.g. the shopper navigates away mid-fetch).
    const controller = new AbortController();

    async function load() {
      const localIds = readRecentlyViewed();

      // Signed out and nothing viewed yet — don't even make the request.
      if (!userId && localIds.length === 0) return;

      try {
        if (userId && localIds.length > 0) {
          // First load after signing in: hand the browsing they did while
          // signed out to their account, then drop the local copy. From here
          // the account is the single source of truth, and nothing is left
          // behind for the next person to sign in on a shared computer.
          await fetch("/api/recently-viewed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ adopt: localIds }),
            signal: controller.signal,
          });
          clearRecentlyViewed();
        }

        // Signed-in callers send no ids: the account history is authoritative
        // and was just topped up by the adoption above.
        const query = userId ? "" : `?ids=${encodeURIComponent(localIds.join(","))}`;
        const res = await fetch(`/api/recently-viewed${query}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json();

        // The shopper turned Browsing History off (possibly on another device) —
        // hide the strip and drop anything this browser still holds.
        if (data.enabled === false) {
          clearRecentlyViewed();
          setItems([]);
          return;
        }

        setItems(Array.isArray(data.items) ? data.items : []);
      } catch {
        // Aborted or offline — leave the strip hidden rather than showing an error.
      }
    }

    load();
    return () => controller.abort();
    // Re-read on navigation: moving between product pages should refresh the
    // strip, since the page it sits on is client-side navigated and would
    // otherwise keep the history from whenever it first mounted. `userId`
    // re-runs it across sign-in and sign-out.
  }, [pathname, userId]);

  // The product currently being viewed shouldn't be offered back to the shopper
  // on its own page. Derived from the URL rather than a prop so the same section
  // works unchanged on HOME, CATEGORY and PRODUCT placements.
  const currentSlug = pathname?.startsWith("/products/")
    ? pathname.slice("/products/".length).split("/")[0]
    : null;

  const products = items
    .map((item) => item.product)
    .filter((p) => p && p.name && p.slug !== currentSlug);

  if (products.length === 0) return null;

  return (
    <section className={SECTION_SHELL}>
      <SectionHeader section={section} />
      <div className="mt-4">
        <FeaturedCarousel products={products} />
      </div>
    </section>
  );
}
