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

## 4. Refund and Return Policies
We support a 15-day return policy for unopened items returned in their original packaging. Upon receiving the return, we inspect the items and process approved refunds back to your original source of payment within 5-7 business days. Shipping costs are non-refundable unless the return is due to a product defect.

## 5. Intellectual Property Rights
All content, text, designs, brand marks, and software code on Ayursanthi belong exclusively to Ayursanthi Wellness. No user may reproduce, re-host, or commercially exploit any material without explicit written consent.

## 6. Limitation of Liability
Ayursanthi Wellness shall not be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use this platform, including delays in shipping, server interruptions, or database synchronization issues.`,
  },
};

// Slugs the admin can edit in /admin/pages.
export const EDITABLE_PAGE_SLUGS = Object.keys(DEFAULT_PAGES);

// Read one page, falling back to the built-in default if no active row exists.
export async function getPage(slug) {
  const fallback = DEFAULT_PAGES[slug] || { slug, title: "", subtitle: "", body: "" };
  try {
    const page = await prisma.page.findUnique({ where: { slug } });
    if (!page || !page.isActive) return fallback;
    return {
      slug: page.slug,
      title: page.title || fallback.title,
      subtitle: page.subtitle ?? fallback.subtitle,
      body: page.body || fallback.body,
    };
  } catch {
    return fallback;
  }
}

// Built-in FAQ fallback (mirrors the original hardcoded list).
export const DEFAULT_FAQS = [
  { question: "How do I create an account?", answer: "Click the Register button in the header and fill in your name, email, phone number, and password. Your account is ready to shop with straight away." },
  { question: "How can I track my orders?", answer: "Login to your account and head to Dashboard → My Orders. You'll see the full history with status (Pending, Confirmed, Shipped, Delivered) along with the item details, price breakdown, and shipping address." },
  { question: "What payment methods are accepted?", answer: "We accept all major credit/debit cards, UPI, and net banking during checkout. All payments are processed through secure, encrypted gateways." },
  { question: "What is the return and refund policy?", answer: "We support a 15-day return policy for unopened products in their original packaging. Approved refunds are processed within 5-7 business days to the original payment source." },
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
