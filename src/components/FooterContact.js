"use client";

import { useEffect, useState } from "react";
import { Phone, Mail } from "lucide-react";

// Admin-managed contact details + social links for the footer. Fetches the
// public settings copy on mount; renders nothing extra until they load.
export function FooterContact() {
  const [s, setS] = useState(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => setS(data.settings || {}))
      .catch(() => setS({}));
  }, []);

  if (!s) return null;

  const socials = [
    { url: s.social_facebook, label: "Facebook" },
    { url: s.social_instagram, label: "Instagram" },
    { url: s.social_twitter, label: "X" },
  ].filter((x) => x.url);

  return (
    <div>
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
        Get in touch
      </h3>
      <div className="mt-4 grid gap-2 text-sm text-slate-300">
        {s.contact_phone ? (
          <a href={`tel:${s.contact_phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-2 hover:text-white">
            <Phone className="size-4" />
            {s.contact_phone}
          </a>
        ) : null}
        {s.contact_email ? (
          <a href={`mailto:${s.contact_email}`} className="inline-flex items-center gap-2 hover:text-white">
            <Mail className="size-4" />
            {s.contact_email}
          </a>
        ) : null}
        {socials.length ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {socials.map(({ url, label }) => (
              <a
                key={label}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded border border-white/15 px-2 py-1 text-xs text-slate-300 hover:border-white/40 hover:text-white"
              >
                {label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
