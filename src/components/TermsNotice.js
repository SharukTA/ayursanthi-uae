import Link from "next/link";

/**
 * The "by doing this, you agree to our terms" line.
 *
 * Deliberately passive — there is no checkbox. The notice sits immediately
 * above/below the button that performs the action, so the click itself is the
 * acceptance (the same sign-in-wrap pattern Amazon, Noon and Shopify's default
 * checkout use). A tickbox would add a failure state to the two highest-value
 * screens in the shop and buy nothing extra, because the evidence comes from
 * the stamp we keep instead: User.termsAcceptedAt / termsVersion at signup and
 * Order.termsVersion at purchase (see lib/pages.js → getTermsVersion).
 *
 * Wording is centralised here so the three call sites can never drift apart.
 *
 * @param {"register"|"order"|"both"} action  which click this notice sits under
 */

const LEAD = {
  register: "By creating an account, you agree to Ayursanthi's",
  order: "By placing your order, you agree to Ayursanthi's",
  // Checkout's inline signup: one click creates the account AND pays.
  both: "By creating an account and placing your order, you agree to Ayursanthi's",
};

export function TermsNotice({
  action = "order",
  className = "text-[11px] leading-4 text-[#565959]",
  linkClassName = "text-[#007185] transition hover:text-[#c7511f] hover:underline",
}) {
  return (
    <p className={className}>
      {LEAD[action] || LEAD.order}{" "}
      {/* Opens in a new tab on purpose: both call sites sit mid-flow on a form
          that is not saved anywhere, so navigating away in place would throw
          away a half-typed signup or a checkout in progress. */}
      <Link
        href="/terms"
        target="_blank"
        rel="noopener noreferrer"
        className={linkClassName}
      >
        terms and conditions
      </Link>
      .
    </p>
  );
}
