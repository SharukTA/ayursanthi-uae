"use client";

import Link from "next/link";
import { useSession } from "@/components/SessionProvider";

// The "My coupons" call to action on the public /gifts page.
//
// It exists as a client component for one reason: /gifts is a marketing page
// shown mostly to signed-out visitors, and pointing them straight at
// /dashboard/gifts means every click hits the proxy's auth redirect. Next tries
// a soft navigation first, the RSC fetch cannot follow a redirect, and the
// browser console fills with "Failed to fetch RSC payload" before the fallback
// hard navigation rescues it. The visitor gets there, but through an error and
// a wasted round trip.
//
// Sending signed-out visitors to /login themselves skips the redirect entirely,
// so there is nothing for the soft navigation to trip over — and the label can
// tell them what is about to happen instead of promising a page they cannot
// reach yet. `next` is preserved so login still lands them on their coupons.
//
// Reads the session from the provider in the root layout rather than fetching,
// so it is correct on first paint with no flash of the wrong label.
export function GiftCouponsCta({ className }) {
  const { session } = useSession();

  const signedIn = Boolean(session);
  const href = signedIn ? "/dashboard/gifts" : "/login?next=/dashboard/gifts";
  const label = signedIn ? "My coupons" : "Sign in to see your coupons";

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
