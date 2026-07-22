// Non-destructive seeder for the homepage CMS blocks.
//
// Unlike prisma/seed.js (which wipes and rebuilds the whole database), this only
// touches the HomeSection / HomeSectionItem tables. It clears any existing
// homepage blocks and recreates the default set, linking to whatever categories
// and products already exist. Safe to run against a live database.
//
// Run:  node scripts/seed-home.mjs
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedSection(position, type, header, items) {
  await prisma.homeSection.create({
    data: {
      type,
      position,
      title: header.title || null,
      eyebrow: header.eyebrow || null,
      subtitle: header.subtitle || null,
      isActive: true,
      items: {
        create: items.map((item, idx) => ({ position: idx, isActive: true, ...item })),
      },
    },
  });
  console.log(`Seeded home section: ${type}`);
}

async function main() {
  console.log("Clearing existing homepage blocks...");
  await prisma.homeSectionItem.deleteMany();
  await prisma.homeSection.deleteMany();

  // Pull existing catalog data to link against.
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    take: 4,
  });
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: { isFeatured: "desc" },
    take: 6,
  });
  const bySlug = Object.fromEntries(products.map((p) => [p.slug, p]));
  const firstImage = async (productId) => {
    const img = await prisma.productImage.findFirst({
      where: { productId },
      orderBy: { sortOrder: "asc" },
    });
    return img?.url || "";
  };

  // VIDEO_CAROUSEL — drives the hero's left panel (My Face product videos in /public)
  await seedSection(0, "VIDEO_CAROUSEL", {}, [
    { videoUrl: "/My face website Video.mp4", title: "My Face Glow", subtitle: "My Face" },
    { videoUrl: "/My face website Video 1.mp4", title: "My Face Care", subtitle: "My Face" },
    { videoUrl: "/My face website Video 2.mp4", title: "My Face Radiance", subtitle: "My Face" },
    { videoUrl: "/My face website Video 3.mp4", title: "My Face Daily", subtitle: "My Face" },
    { videoUrl: "/My face website Video 4.mp4", title: "My Face Ritual", subtitle: "My Face" },
    { videoUrl: "/My face website Video 5.mp4", title: "My Face Renew", subtitle: "My Face" },
    { videoUrl: "/My face website Video 6.mp4", title: "My Face Shine", subtitle: "My Face" },
  ]);

  // STATS_BAR — scrolling strip: live metrics + static trust promises
  await seedSection(0, "STATS_BAR", {}, [
    { metric: "REGISTERED_CUSTOMERS", title: "registered customers" },
    { metric: "PAID_ORDERS", title: "successful bookings" },
    { metric: "STATIC", title: "100% Natural Ingredients" },
    { metric: "STATIC", title: "Free shipping over Rs. 1000" },
    { metric: "STATIC", title: "Secure encrypted checkout" },
    { metric: "STATIC", title: "AYUSH certified products" },
  ]);

  // DEAL_GRID — "Deals just for you" (static promo art shipped in /public)
  await seedSection(1, "DEAL_GRID", {
    eyebrow: "Today's offers",
    title: "Deals just for you",
    subtitle: "Limited-time savings on our most-loved Kamakalpa and My Face picks.",
  }, [
    { subtitle: "Deals on desires", title: "Kamakalpa Nabhi Oil", badge: "Up to 40% off", imageUrl: "/KAMAKALPA%20NABHI%20OIL.png", href: "/products" },
    { subtitle: "Deals on desires", title: "Kamakalpa Special", badge: "Min. 25% off", imageUrl: "/Kamakalpa%20item%201.jpeg", href: "/products" },
    { subtitle: "Deals on face glow", title: "My Face Glow", badge: "Up to 50% off", imageUrl: "/My%20face%20item.jpeg", href: "/products" },
    { subtitle: "Deals on face glow", title: "My Face Care", badge: "Min. 30% off", imageUrl: "/My%20face%20item%201.jpeg", href: "/products" },
  ]);

  // CATEGORY_GRID — "Shop by category" (links to existing categories)
  if (categories.length) {
    await seedSection(2, "CATEGORY_GRID", {
      eyebrow: "Explore our range",
      title: "Shop by category",
      subtitle: "Browse the wellness collections curated by our team.",
    }, categories.map((c) => ({
      title: c.name,
      body: c.description,
      imageUrl: c.imageUrl,
      href: `/categories/${c.slug}`,
    })));
  }

  // PRODUCT_CAROUSEL — "Popular Picks This Week" (links to existing products)
  const tags = ["Featured", "Best seller", "New", "Trending", "Limited", "Hot"];
  const carouselItems = [];
  let idx = 0;
  for (const p of products.slice(0, 5)) {
    carouselItems.push({
      productId: p.id,
      subtitle: tags[idx % tags.length],
      imageUrl: await firstImage(p.id),
    });
    idx++;
  }
  if (carouselItems.length) {
    await seedSection(3, "PRODUCT_CAROUSEL", {
      eyebrow: "Featured Products",
      title: "Popular Picks This Week",
      subtitle: "Hover or swipe — discover what our community loves most.",
    }, carouselItems);
  }

  // PROMO_ADS — "Spotlight"
  await seedSection(4, "PROMO_ADS", {
    eyebrow: "Featured products",
    title: "Spotlight",
  }, [
    { title: "Kamakalpa Nabhi Oil", body: "Traditional ayurvedic navel oil for daily wellness.", imageUrl: "/KAMAKALPA%20NABHI%20OIL.png" },
    { title: "Now Available", body: "Discover our newly launched featured range.", imageUrl: "/my%20face%20poster%201.jpg.jpeg" },
  ]);

  // REVIEWS — customer testimonials
  await seedSection(5, "REVIEWS", {
    eyebrow: "Customer confidence",
    title: "What our customers say",
  }, [
    { title: "Anjali R.", body: "The product selection feels organized, premium, and simple to browse." },
    { title: "Rahul M.", body: "Checkout is quick and my orders have arrived on time every single order." },
    { title: "Meera S.", body: "Clear product information helps me compare and choose with confidence." },
  ]);

  // Default site settings (contact + socials) — upsert so admin edits aren't lost
  // unless the key was never set.
  const defaultSettings = {
    contact_phone: "+91 99999 99999",
    contact_email: "support@ayursanthi.com",
    contact_company: "Ayursanthi Wellness Corp",
    contact_address: "Kochi, Kerala, India",
    contact_hours: "Mon-Sat, 9AM - 6PM",
    contact_dispatch: "98% Same-day dispatch",
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.siteSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  console.log("Seeded default site settings.");

  // Default FAQ items — only if the admin hasn't added any (don't clobber edits).
  if ((await prisma.faqItem.count()) === 0) {
    await prisma.faqItem.createMany({
      data: [
        { question: "How do I create an account?", answer: "Click the Register button in the header and fill in your name, email, phone number, and password.", sortOrder: 0 },
        { question: "How can I track my orders?", answer: "Login and go to Dashboard → My Orders to see status, item details, price breakdown, and shipping address.", sortOrder: 1 },
        { question: "What payment methods are accepted?", answer: "All major credit/debit cards, UPI, and net banking — processed through secure, encrypted gateways.", sortOrder: 2 },
        { question: "What is the return and refund policy?", answer: "A 15-day return policy for unopened products in original packaging. Approved refunds are processed within 5-7 business days.", sortOrder: 3 },
      ],
    });
    console.log("Seeded default FAQ items.");
  }

  console.log("Homepage blocks seeded successfully.");
}

main()
  .catch((e) => {
    console.error("Error seeding homepage blocks:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
