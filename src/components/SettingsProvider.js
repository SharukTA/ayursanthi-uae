"use client";

import { createContext, useContext } from "react";

// Holds the admin-editable site settings (contact details, social links,
// delivery rules) for the whole app. The value is read from the database in the
// root layout and passed in as a prop, so the first paint already has the real
// contact details and social links — the same reason SessionProvider is seeded
// server-side rather than fetched on mount.
//
// This matters more here than it looks: the footer renders on every page. A
// client-side fetch would mean five `/api/settings` round-trips on a five-page
// session, and the social icons would pop in after paint. Seeding from the
// server also puts the <a href> values in the HTML, so they are real links to
// anything reading the page without running JS.
//
// There is no setter. Settings only change when an admin saves them in
// /admin/settings, which is a different page — by the time a shopper sees a
// footer, the server has already re-rendered with the new values.
const SettingsContext = createContext({});

export function SettingsProvider({ settings = {}, children }) {
  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

// Returns the merged settings map (defaults with any admin overrides applied).
// Always an object, so `useSiteSettings().contact_phone` is safe to read
// directly even if the provider is missing.
export function useSiteSettings() {
  return useContext(SettingsContext);
}
