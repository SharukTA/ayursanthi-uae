const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// NOTE: this script seeds DEMO content only and does NOT create an admin user.
// Create your admin separately with `node prisma/create-admin.js`.

async function main() {
  console.log("Starting database seeding...");

  // 1. Clean existing records (Optional, but ensures idempotence)
  await prisma.homeSectionItem.deleteMany();
  await prisma.homeSection.deleteMany();
  await prisma.siteSetting.deleteMany();
  await prisma.faqItem.deleteMany();
  await prisma.page.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.productReview.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.address.deleteMany();
  await prisma.user.deleteMany();

  console.log("Cleared existing database records.");

  // 2. Create Seed Categories
  const catDaily = await prisma.category.create({
    data: {
      name: "Daily Wellness",
      slug: "daily-wellness",
      description: "Immunity care, herbal tonics, family wellness kits",
      imageUrl: "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=900",
    },
  });

  const catSkin = await prisma.category.create({
    data: {
      name: "Skin & Hair",
      slug: "skin-hair",
      description: "Oils, cleansers, scalp care, natural body care",
      imageUrl: "https://images.pexels.com/photos/18680598/pexels-photo-18680598.jpeg?auto=compress&cs=tinysrgb&w=900",
    },
  });

  const catDigestive = await prisma.category.create({
    data: {
      name: "Digestive Care",
      slug: "digestive-care",
      description: "Herbal support for daily digestive balance and comfort",
      imageUrl: "https://images.pexels.com/photos/8469436/pexels-photo-8469436.jpeg?auto=compress&cs=tinysrgb&w=900",
    },
  });

  const catBundles = await prisma.category.create({
    data: {
      name: "Wellness Bundles",
      slug: "wellness-bundles",
      description: "Starter kits, family packs, and multi-product bundles",
      imageUrl: "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=900",
    },
  });

  console.log("Seeded 4 core categories.");

  // 4. Create Products
  const productsData = [
    {
      categoryId: catDaily.id,
      name: "Herbal Wellness Kit",
      slug: "herbal-wellness-kit",
      sku: "HWK001",
      shortDescription: "A complete wellness pack for family immunity and vitality.",
      description: "Our Herbal Wellness Kit features a premium selection of ayurvedic formulations. Contains Chyawanprash, organic tulsi drops, and giloy capsules designed to strengthen daily immune defenses, enhance metabolic balance, and support full-body wellness.",
      price: 1499.00,
      mrp: 1799.00,
      stock: 100,
      isFeatured: true,
      images: [
        "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=900",
      ],
    },
    {
      categoryId: catSkin.id,
      name: "Ayurvedic Hair Oil",
      slug: "ayurvedic-hair-oil",
      sku: "AHO002",
      shortDescription: "Premium herbal hair oil enriched with Bhringraj and Amla.",
      description: "Enriched with 15 active herbs, our Ayurvedic Hair Oil nourishes the scalp deeply, prevents hair fall, controls dandruff, and promotes thick, healthy growth. Massaging daily helps relax and soothe tension.",
      price: 349.00,
      mrp: 399.00,
      stock: 150,
      isFeatured: true,
      images: [
        "https://images.pexels.com/photos/18680598/pexels-photo-18680598.jpeg?auto=compress&cs=tinysrgb&w=900",
      ],
    },
    {
      categoryId: catDaily.id,
      name: "Daily Immunity Tonic",
      slug: "daily-immunity-tonic",
      sku: "DIT003",
      shortDescription: "Traditional ayurvedic formulation to boost immunity and energy.",
      description: "A liquid herbal tonic featuring Ashwagandha, Shatavari, and Amalaki. Supports respiratory health, rejuvenates cells, and increases stamina for busy lifestyles.",
      price: 599.00,
      mrp: 699.00,
      stock: 120,
      isFeatured: true,
      images: [
        "https://images.pexels.com/photos/10863953/pexels-photo-10863953.jpeg?auto=compress&cs=tinysrgb&w=900",
      ],
    },
    {
      categoryId: catDigestive.id,
      name: "Triphala Digestive Powder",
      slug: "triphala-digestive-powder",
      sku: "TDP004",
      shortDescription: "Natural digestive care powder supporting bowel regularity.",
      description: "Pure Triphala powder comprising Amalaki, Bibhitaki, and Haritaki. Supports healthy digestion, detoxifies the system, and regulates gastrointestinal activity naturally.",
      price: 249.00,
      mrp: 299.00,
      stock: 200,
      isFeatured: false,
      images: [
        "https://images.pexels.com/photos/8469436/pexels-photo-8469436.jpeg?auto=compress&cs=tinysrgb&w=900",
      ],
    },
    {
      categoryId: catBundles.id,
      name: "Wellness Starter Pack",
      slug: "wellness-starter-pack",
      sku: "WSP005",
      shortDescription: "Our three best-selling essentials in one discounted bundle.",
      description: "A curated starter bundle for anyone new to Ayurveda. Includes the Herbal Wellness Kit, Ayurvedic Hair Oil, and Triphala Digestive Powder — everything needed for a complete daily routine, at a lower price than buying each separately.",
      price: 2999.00,
      mrp: 3499.00,
      stock: 50,
      isFeatured: true,
      images: [
        "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=900",
      ],
    },
  ];

  // Keep created products keyed by slug so home sections can link to them.
  const productBySlug = {};
  for (const prod of productsData) {
    const { images, ...productFields } = prod;
    const createdProduct = await prisma.product.create({
      data: {
        ...productFields,
        isActive: true,
        images: {
          create: images.map((url, idx) => ({
            url,
            altText: `${prod.name} Image ${idx + 1}`,
            sortOrder: idx,
          })),
        },
      },
    });
    productBySlug[createdProduct.slug] = createdProduct;
    console.log(`Seeded Product: ${createdProduct.name} (${createdProduct.sku})`);
  }

  // 5. Seed the homepage (Home Builder) blocks. These reproduce the content the
  // homepage used to hardcode, but now every block is editable in /admin/home.
  // Helper to create a section with its items in one call.
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

  // VIDEO_CAROUSEL — drives the hero's left panel (My Face videos in /public)
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
    { metric: "STATIC", title: "AYUSH certified products" },
  ]);

  // DEAL_GRID — "Deals just for you"
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

  // CATEGORY_GRID — "Shop by category" (links to the seeded categories)
  await seedSection(2, "CATEGORY_GRID", {
    eyebrow: "Explore our range",
    title: "Shop by category",
    subtitle: "Browse the wellness collections curated by our team.",
  }, [catDaily, catSkin, catDigestive, catBundles].map((c) => ({
    title: c.name,
    body: c.description,
    imageUrl: c.imageUrl,
    href: `/categories/${c.slug}`,
  })));

  // PRODUCT_CAROUSEL — "Popular Picks This Week" (linked to real products)
  await seedSection(3, "PRODUCT_CAROUSEL", {
    eyebrow: "Featured Products",
    title: "Popular Picks This Week",
    subtitle: "Hover or swipe — discover what our community loves most.",
  }, [
    { productId: productBySlug["herbal-wellness-kit"]?.id, subtitle: "Featured", imageUrl: "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=900" },
    { productId: productBySlug["ayurvedic-hair-oil"]?.id, subtitle: "Best seller", imageUrl: "https://images.pexels.com/photos/18680598/pexels-photo-18680598.jpeg?auto=compress&cs=tinysrgb&w=900" },
    { productId: productBySlug["daily-immunity-tonic"]?.id, subtitle: "New", imageUrl: "https://images.pexels.com/photos/10863953/pexels-photo-10863953.jpeg?auto=compress&cs=tinysrgb&w=900" },
    { productId: productBySlug["wellness-starter-pack"]?.id, subtitle: "Trending", imageUrl: "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=900" },
  ]);

  // PROMO_ADS — "Spotlight"
  await seedSection(4, "PROMO_ADS", {
    eyebrow: "Featured products",
    title: "Spotlight",
  }, [
    { title: "Kamakalpa Nabhi Oil", body: "Traditional ayurvedic navel oil for daily wellness.", imageUrl: "/KAMAKALPA%20NABHI%20OIL.png" },
    { title: "Now Available", body: "Discover our newly launched featured range.", imageUrl: "/my%20face%20poster%201.jpg.jpeg" },
  ]);

  // REVIEWS — real customer reviews, pulled live from verified buyers' ProductReview
  // rows (see lib/page-sections.js). No items are seeded: the admin only owns the
  // heading; the cards are 100% customer-written and appear once real reviews exist.
  await seedSection(5, "REVIEWS", {
    eyebrow: "Customer confidence",
    title: "What our customers say",
  }, []);

  // 6. Default site settings.
  const defaultSettings = {
    contact_phone: "+91 99999 99999",
    contact_email: "support@ayursanthi.com",
    contact_company: "Ayursanthi Wellness Corp",
    contact_address: "Kochi, Kerala, India",
    contact_hours: "Mon-Sat, 9AM - 6PM",
    contact_dispatch: "98% Same-day dispatch",
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.siteSetting.create({ data: { key, value } });
  }

  await prisma.faqItem.createMany({
    data: [
      { question: "How do I create an account?", answer: "Click the Register button in the header and fill in your name, email, phone number, and password.", sortOrder: 0 },
      { question: "How can I track my orders?", answer: "Login and go to Dashboard → My Orders to see status, item details, price breakdown, and shipping address.", sortOrder: 1 },
      { question: "What payment methods are accepted?", answer: "All major credit/debit cards, UPI, and net banking — processed through secure, encrypted gateways.", sortOrder: 2 },
      { question: "What is the return and refund policy?", answer: "A 15-day return policy for unopened products in original packaging. Approved refunds are processed within 5-7 business days.", sortOrder: 3 },
    ],
  });

  console.log("Database seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
