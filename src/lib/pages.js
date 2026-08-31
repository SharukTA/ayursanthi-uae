import { prisma } from "@/lib/prisma";

// Built-in fallback content for editable pages. Until an admin saves a Page row
// (in /admin/pages), the public page renders these defaults — so nothing ever
// looks empty. Bodies use the small markdown subset understood by RichText.
export const DEFAULT_PAGES = {
  about: {
    slug: "about",
    title: "A 400-Year Legacy of Authentic Ayurveda",
    subtitle:
      "Established in 1960 in Kerala, India — carrying forward a 400-year legacy of authentic Ayurvedic wellness.",
    body: `Ayursanthi, established in 1960 and headquartered in Kerala, India, carries forward a prestigious 400-year-old legacy. Renowned for harmoniously blending the profound insights of ancient Ayurveda, Jyothisham, and traditions found in rare manuscripts with contemporary scientific understanding, we craft wellness solutions that are both deeply rooted in heritage and perfectly adapted to modern life.

Guided by the leadership of Dr. Mohammad Ali Shihab and a commitment to 100% chemical-free and eco-friendly products, our mission is to deliver authentic, high-quality formulations across wellness, beauty, and personal care through our global platform, Ayurshoppee.

What distinguishes Ayursanthi is our direct connection to an unbroken tradition of healing knowledge — not mere approximations of recipes, but a living continuation of practices refined over centuries to ensure safety for humans, animals, and the environment.`,
  },
  terms: {
    slug: "terms",
    title: "Terms of Service",
    subtitle: "Last updated: May 24, 2026",
    body: `## 1. Acceptance of Terms
By accessing and using the Ayursanthi e-commerce site, you agree to comply with and be bound by these Terms and Conditions. If you do not agree, you must cease using the platform immediately.

## 2. User Account Registration & Security
When registering an account with us, you represent that all information provided is accurate and current. You are solely responsible for maintaining the confidentiality of your credentials. Any unauthorized activity on your account must be reported to our support coordinators immediately.

## 3. Products, Pricing & Billing
We make every effort to display the colors, specifications, and prices of our ayurvedic products accurately. We reserve the right to modify prices or adjust shipping configurations without notice. Payment processing must be made through our authorized checkout gateways using valid cards or UPI keys.

## 4. Cancellations and Refunds
We do not offer returns or replacements on any product. Orders may be cancelled from your account at any time before they are handed to the courier; once an order has shipped it can no longer be cancelled. If payment has already been collected on a cancelled order, the full amount is refunded within 3-5 business days.

## 5. Intellectual Property Rights
All content, text, designs, brand marks, and software code on Ayursanthi belong exclusively to Ayursanthi Wellness. No user may reproduce, re-host, or commercially exploit any material without explicit written consent.

## 6. Limitation of Liability
Ayursanthi Wellness shall not be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use this platform, including delays in shipping, server interruptions, or database synchronization issues.`,
  },
};

// Slugs the admin can edit in /admin/pages.
export const EDITABLE_PAGE_SLUGS = Object.keys(DEFAULT_PAGES);

// Optional extra sections on the About page, in the order they render below the
// brand story. Unlike DEFAULT_PAGES these have NO built-in content: until an
// admin saves one there is no row, and the public page simply omits the whole
// section. They are stored as ordinary Page rows so they reuse the same editor,
// API and isActive toggle as the core pages.
export const ABOUT_OPTIONAL_SECTIONS = [
  { slug: "about-vision", label: "Our Vision", suggestedTitle: "Our Vision" },
  { slug: "about-mission", label: "Our Mission", suggestedTitle: "Our Mission" },
];

export const OPTIONAL_PAGE_SLUGS = ABOUT_OPTIONAL_SECTIONS.map((s) => s.slug);

// Everything /api/admin/pages will accept a write for.
export const ALL_EDITABLE_PAGE_SLUGS = [...EDITABLE_PAGE_SLUGS, ...OPTIONAL_PAGE_SLUGS];

// Slugs that may be saved with no heading at all — their title renders as an
// h2 inside the page body (the h1 is fixed markup), so dropping it just means
// the prose starts without a heading. /terms is excluded: its title sits in a
// bordered icon block that would read as broken when empty.
export const TITLE_OPTIONAL_SLUGS = ["about", ...OPTIONAL_PAGE_SLUGS];

// The optional About sections that should actually render, in display order.
// A section is skipped when the admin never added it (no row), hid it
// (isActive false), or saved it with no body text. The heading is optional —
// a section with body text and no heading renders as bare prose.
export async function getAboutSections() {
  try {
    const rows = await prisma.page.findMany({
      where: { slug: { in: OPTIONAL_PAGE_SLUGS } },
    });
    const bySlug = Object.fromEntries(rows.map((row) => [row.slug, row]));

    return OPTIONAL_PAGE_SLUGS.map((slug) => bySlug[slug])
      .filter((row) => row?.isActive && row.body?.trim())
      .map((row) => ({ slug: row.slug, title: row.title?.trim() || "", body: row.body }));
  } catch {
    return [];
  }
}

// Read one page, falling back to the built-in default if no active row exists.
export async function getPage(slug) {
  const fallback = DEFAULT_PAGES[slug] || { slug, title: "", subtitle: "", body: "" };
  try {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page || !page.isActive) return fallback;
    return {
      slug: page.slug,
      // Where the heading is optional, a saved row wins outright: an admin who
      // cleared the field meant "no heading", not "fall back to the built-in".
      title: page.title || (TITLE_OPTIONAL_SLUGS.includes(slug) ? "" : fallback.title),
      subtitle: page.subtitle ?? fallback.subtitle,
      body: page.body || fallback.body,
    };
  } catch {
    return fallback;
  }
}

// Identifies the built-in terms body, for accounts and orders stamped while no
// admin-edited Page row is live. Bump only if DEFAULT_PAGES.terms itself changes.
export const TERMS_DEFAULT_VERSION = "builtin-2026-05-24";

/**
 * Which revision of the conditions of use was live right now.
 *
 * Stamped onto a User at signup and onto every Order at placement, so a dispute
 * can be answered with the exact text the customer accepted rather than with
 * whatever /terms happens to say today. The Page row's own updatedAt is the
 * version — the terms are admin-editable, so anything hand-maintained would go
 * stale the first time someone edits them without remembering to bump it.
 *
 * Never throws: this is evidence-keeping, not a gate. A database hiccup here
 * must not be able to fail a registration or a checkout, so the worst case is
 * an order stamped with the fallback string.
 */
export async function getTermsVersion() {
  try {
    const page = await prisma.page.findUnique({
      where: { slug: "terms" },
      select: { isActive: true, updatedAt: true },
    });
    // An inactive row is not what the shopper saw — /terms renders the built-in
    // default in that case, so that is what they agreed to.
    if (!page || !page.isActive) return TERMS_DEFAULT_VERSION;
    return page.updatedAt.toISOString();
  } catch {
    return TERMS_DEFAULT_VERSION;
  }
}

// Built-in FAQ fallback (mirrors the original hardcoded list).
export const DEFAULT_FAQS = [
  { question: "How do I create an account?", answer: "Click the Register button in the header and fill in your name, email, phone number, and password. Your account is ready to shop with straight away." },
  { question: "How can I track my orders?", answer: "Login to your account and head to Dashboard → My Orders. You'll see the full history with status (Pending, Confirmed, Shipped, Delivered) along with the item details, price breakdown, and shipping address." },
  { question: "What payment methods are accepted?", answer: "We accept all major credit/debit cards, UPI, and net banking during checkout. All payments are processed through secure, encrypted gateways." },
  { question: "Can I cancel my order?", answer: "Yes. Go to Dashboard → My Orders and cancel any order that has not yet been handed to the courier. Once an order ships it can no longer be cancelled. We do not accept returns or replacements, so please check your order carefully before it is dispatched." },
];

// Read active FAQ items, falling back to the built-in list if none exist.
export async function getFaqs() {
  try {
    const items = await prisma.faqItem.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    if (items.length === 0) return DEFAULT_FAQS;
    return items.map((i) => ({ question: i.question, answer: i.answer }));
  } catch {
    return DEFAULT_FAQS;
  }
}
