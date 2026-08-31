"use client";

import { useSiteSettings } from "@/components/SettingsProvider";

// The registered business identity in the footer's bottom bar.
//
// This is the site-wide disclosure half of the address: the legal entity name
// and its registered address, on every page. The richer version — phone, email,
// hours, the contact form — stays on /contact. Two reasons it earns a spot here
// rather than living only on that page:
//
//   1. Stripe's account review looks for the business name, a physical address,
//      and reachable contact/policy pages on the public site. A footer satisfies
//      that everywhere; one card on /contact is easy for a reviewer to miss.
//   2. UAE e-commerce rules require a merchant to disclose who they are, and the
//      convention in every market that mandates this (UK, EU, India) is the
//      footer — which is also where shoppers have learned to look for it.
//
// Both values are admin-editable in /admin/settings → Contact details, so this
// never needs a code change when the licence or office moves.
//
// `text-slate-400` is deliberate: globals.css maps it to rgba(255,255,255,.72)
// inside <footer>, the same muted tone as the column headings above. Plain
// `text-white` would be re-asserted to solid white and shout over the copyright.
export function FooterAddress() {
  const settings = useSiteSettings();
  const company = String(settings.contact_company ?? "").trim();
  const address = String(settings.contact_address ?? "").trim();

  // Nothing configured — render nothing rather than an empty gap above the
  // copyright line.
  if (!company && !address) return null;

  return (
    // <address> is the correct element for the contact details of the page's
    // owner, and it is what parsers look for. It italicises by default, hence
    // `not-italic`.
    <address className="not-italic text-center text-xs leading-relaxed text-slate-400">
      {company ? <span className="block font-semibold">{company}</span> : null}
      {address ? <span className="block">{address}</span> : null}
    </address>
  );
}
