// A staging deploy must never be indexed. It is a byte-for-byte copy of the
// store on a different host, so leaving it crawlable puts two identical sites in
// front of Google for the same keywords and lets Google — not us — pick which
// one is canonical. Losing that coin toss means ayurshoppee.ae gets demoted in
// favour of a URL customers were never meant to see.
//
// Keyed off STAGING_PASSWORD rather than a flag of its own so there is exactly
// one variable to remember: a deploy that is password-gated is by definition not
// the public site, and a deploy that is not gated is production. The two can
// never drift out of step.
const IS_STAGING = Boolean(process.env.STAGING_PASSWORD);

export default function robots() {
  if (IS_STAGING) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Everything here is either behind a login or meaningless without a
      // session, so a crawler spending its budget on these pages is pure waste.
      disallow: ["/admin/", "/dashboard/", "/api/", "/checkout", "/cart", "/my-shop"],
    },
  };
}
