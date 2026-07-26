"use client";

import { useEffect } from "react";
import { pushRecentlyViewed } from "@/lib/recently-viewed";
import { useSession } from "@/components/SessionProvider";

// Mounted on the product detail page. Renders nothing — its only job is to note
// that this shopper looked at this product, so a RECENTLY_VIEWED block can offer
// it back to them later ("Continue shopping").
//
// Where the note goes depends on who is looking:
//   signed in  → their account, so the history follows them to other devices.
//                The server ignores the write if they've turned Browsing History
//                off, so the switch cannot be bypassed from the client.
//   signed out → their own browser only; nothing about them reaches the server.
//
// The write happens in an effect (never during render) so it runs once, in the
// browser only, after the page has painted. `SessionProvider` is seeded on the
// server, so `session` is already correct on that first pass — no risk of
// mis-routing the write while auth resolves.
export function RecentlyViewedTracker({ productId }) {
  const { session } = useSession();
  const userId = session?.userId ?? null;

  useEffect(() => {
    if (!userId) {
      pushRecentlyViewed(productId);
      return;
    }

    // Fire-and-forget: this is bookkeeping the shopper never asked for, so a
    // failure must stay silent and must not block anything on the page.
    const controller = new AbortController();
    fetch("/api/recently-viewed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId }),
      signal: controller.signal,
    }).catch(() => {});

    return () => controller.abort();
  }, [productId, userId]);

  return null;
}
