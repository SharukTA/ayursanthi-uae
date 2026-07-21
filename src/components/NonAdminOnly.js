"use client";

import { useSession } from "@/components/SessionProvider";

// Renders its children for everyone EXCEPT logged-in admins.
// Used to hide shopper-facing links (e.g. Support) from the admin view.
// The session is resolved on the server, so the correct content is shown on the
// first paint — no flash of shopper links before an admin's view settles.
export function NonAdminOnly({ children }) {
  const { session } = useSession();

  if (session?.role === "ADMIN") return null;
  return children;
}
