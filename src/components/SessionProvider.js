"use client";

import { createContext, useContext, useEffect, useState } from "react";

// Holds the authenticated session for the whole app. The initial value is
// resolved on the server (in the root layout) and passed in as a prop, so the
// first client paint already knows who the user is — no flash of the wrong
// navbar/footer while a client-side fetch resolves.
const SessionContext = createContext({ session: null });

export function SessionProvider({ initialSession = null, children }) {
  const [session, setSession] = useState(initialSession);

  // Keep the client copy in sync after login/logout. We intentionally do NOT
  // fetch on mount — the server already gave us the correct value, and a mount
  // fetch is exactly what caused the navbar to glitch on every navigation.
  useEffect(() => {
    async function refresh() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        setSession(data.loggedIn ? data.session : null);
      } catch (err) {
        setSession(null);
      }
    }
    window.addEventListener("authUpdate", refresh);
    return () => window.removeEventListener("authUpdate", refresh);
  }, []);

  return (
    <SessionContext.Provider value={{ session }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}
