"use client";

import { useSession } from "@/components/SessionProvider";

// Renders its children only for visitors who are NOT authenticated.
// Used to hide "create account" style CTAs once a user is logged in.
// The session is resolved on the server, so there's no flash of the CTA for
// already-authenticated users.
export function UnauthOnly({ children }) {
  const { session } = useSession();

  if (session) return null;
  return children;
}
