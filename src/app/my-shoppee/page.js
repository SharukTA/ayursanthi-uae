import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { ShortcutCard } from "@/components/HomeShortcutCards";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "MY-SHOPPEE | Ayurshoppee",
  description:
    "Shop online, promote products, build your business and earn through sales with MY-SHOPPEE, the Ayursanthi Ayurveda online store and partner network.",
};

// The MY-SHOPPEE business plan as the client supplied it (a PDF), set in the site's
// flat content-page style: ink headings over hairlines, like /about. The figures here
// are the plan's own and are not read from the shop programme's settings.

const SHOP_CARDS = [
  {
    href: "/join-shop",
    label: "Join Shoppee",
    image: "/images/home-cards/partnership.jpg", // pexels.com/photo/4963437
    focus: "50% 50%",
  },
  {
    href: "/my-shop",
    label: "View My Shoppee",
    image: "/images/home-cards/my-shop.jpg", // pexels.com/photo/36729522
    focus: "50% 60%",
  },
];

const LEVELS = [
  {
    title: "WWW-SHOP – Official Online Store",
    body: (
      <>
        Visit{" "}
        <Link href="/" className="font-semibold text-[#007185] hover:underline">
          www.ayurshoppee.ae
        </Link>{" "}
        to explore and purchase our Ayurveda products through our official online shopping
        platform. This window is intended for the purchase of Ayursanthi products by anyone
        around the world.
      </>
    ),
  },
  {
    title: "MY-SHOP – Individual Online Shop",
    body: (
      <>
        Become a Shop Owner and receive your unique Shop Code.
        <br />
        <br />
        Your individual online shop allows you to promote and market our products. You can
        develop your customer network and earn profit-sharing benefits based on your eligible
        sales and applicable business plan.
      </>
    ),
  },
  {
    title: "MY-SHOP – Distributor Network",
    body: (
      <>
        Become an affiliated Distributor and receive your unique Distributor Code and
        Affiliation Coupon Code.
        <br />
        <br />
        These codes enable you to participate in our online distribution and product marketing
        network, subject to the company&apos;s terms and conditions.
      </>
    ),
  },
];

const SHOP_OWNER_BENEFITS = {
  head: ["Participation Amount (AED)", "Product", "Benefit", "Quantity", "No. of Distributors under you"],
  rows: [["100,000", "My Face", "10%", "4444", "Minimum 15 at a time"]],
};

const DISTRIBUTOR_BENEFITS = {
  head: ["Product", "Quantity", "Profit %"],
  rows: [
    ["MY FACE", "51", "10%"],
    ["MY FACE", "101", "13%"],
    ["MY FACE", "201", "14%"],
    ["MY FACE", "301", "15%"],
  ],
};

const PRICE_LIST = {
  head: ["Product", "Qty", "MRP (AED)", "10%", "13%", "14%", "15%"],
  rows: [
    ["My Face Sandal", "30 gm × 1", "30", "3.00", "3.90", "4.20", "4.50"],
    ["My Face Sandal", "30 gm × 4", "100", "10.00", "13.00", "14.00", "15.00"],
    ["My Face Oudh", "30 gm × 1", "50", "5.00", "6.50", "7.00", "7.50"],
  ],
};

const DISTRIBUTOR_GETS = [
  "A unique Distributor Code.",
  "An Affiliation Coupon Code.",
  "Access to the applicable online distribution pricing structure.",
  "An opportunity to market and promote MY-SHOPPEE products.",
  "Profit-sharing benefits according to your eligible sales and applicable benefit level.",
  "A dashboard to help you track your offtake and commission details.",
];

const TERMS = [
  {
    title: "Shop Owner Authorisation",
    paragraphs: [
      "Every Shop Owner is authorised to conduct business exclusively through their officially assigned MY-SHOPPEE Shop Code. To avail a Shop Owner code, one should assign not less than 14 Distributors under them.",
      "The assigned Shop Code is intended for authorised business transactions under the MY-SHOPPEE platform.",
    ],
  },
  {
    title: "Distributor Authorisation",
    paragraphs: [
      "Every Distributor is authorised to conduct business using their officially assigned Distributor Code and Affiliation Coupon Code. These codes must be used in accordance with the company's policies and procedures.",
    ],
  },
  {
    title: "Brand and Store Policy",
    paragraphs: [
      "The AYURSHOPPEE / MY-SHOPPEE brand names are protected business identities.",
      "No individual Shop Owner or Distributor is permitted to independently establish or operate a physical retail outlet or store using these brand names without obtaining prior written approval from the management.",
    ],
  },
  {
    title: "Online Payment Policy",
    paragraphs: [
      "All financial transactions and payments relating to MY-SHOPPEE business activities must be carried out exclusively through the official online payment gateway. The company will not recognise or entertain offline cash transactions.",
    ],
  },
  {
    title: "Profit-Sharing Payment Schedule",
    paragraphs: [
      <>
        Eligible profit-sharing payments will be processed on the{" "}
        <strong>2nd day of every calendar month</strong>. If the 2nd day falls on a public
        holiday, the payment will be processed on the next working day.
      </>,
    ],
  },
  {
    title: "Private Financial Transactions",
    paragraphs: [
      "The company shall not be responsible or liable for any private cash transactions or individual financial dealings carried out between dealers, distributors or other third parties in the name of AYURSHOPPEE / MY-SHOPPEE.",
      "Any such transactions are undertaken entirely at the individuals' own risk and responsibility. The parties involved must settle such dealings directly among themselves.",
    ],
  },
  {
    title: "Product Line Addition",
    paragraphs: [
      "New products will be added to the online store upon availability and approval from the concerned authority.",
    ],
  },
];

const PROSE = "max-w-4xl text-sm leading-7 text-[#0f1111] sm:text-base sm:leading-8";

function Section({ title, subtitle, children }) {
  return (
    <section className="border-b border-border py-8 sm:py-10">
      <h2 className="text-xl font-bold uppercase tracking-tight text-[#0f1111] sm:text-2xl">
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-1 text-base font-semibold text-[#565959] sm:text-lg">{subtitle}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SubHeading({ children }) {
  return <h3 className="mt-6 text-base font-bold text-[#0f1111] sm:text-lg">{children}</h3>;
}

// Same treatment as the product page's details table: a rounded hairline box with a
// tinted header row. A table wider than three columns cannot fit a phone, so below md
// each row becomes its own card instead: the first cell as the card's title, the rest
// as label and value pairs. Three columns fit at any width and stay a table throughout.
function PlanTable({ head, rows, caption }) {
  const stacks = head.length > 3;

  return (
    <div className="mt-4 max-w-4xl">
      {stacks ? (
        <div className="grid gap-3 sm:grid-cols-2 md:hidden">
          {rows.map((row, i) => (
            <div key={i} className="rounded-lg border border-[#d5d9d9] bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold text-slate-600">{head[0]}</p>
              <p className="mt-0.5 text-base font-bold text-[#0f1111]">{row[0]}</p>
              <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-slate-100 pt-3 text-sm">
                {row.slice(1).map((cell, j) => (
                  <div key={j}>
                    <dt className="text-xs font-semibold text-slate-600">{head[j + 1]}</dt>
                    <dd className="mt-0.5 text-slate-800">{cell}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : null}
      <div
        className={`overflow-x-auto rounded-lg border border-[#d5d9d9] bg-white shadow-sm ${stacks ? "hidden md:block" : ""}`}
      >
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50">
            <tr>
              {head.map((label) => (
                <th key={label} scope="col" className="px-3 py-3 font-semibold text-slate-600 sm:px-4">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className={`px-3 py-3 text-slate-800 sm:px-4 ${j === 0 ? "font-semibold" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {caption ? <p className="mt-2 text-xs italic leading-5 text-[#565959]">{caption}</p> : null}
    </div>
  );
}

export default function MyShoppeePage() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-white">
      <SiteHeader />

      <section className="bg-slate-950 py-10 text-center text-white sm:py-14">
        <div className="mx-auto max-w-2xl px-4">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">MY-SHOPPEE</h1>
          <p className="mt-3 text-base leading-7 text-slate-300 sm:text-lg">
            Your Online Ayursanthi Ayurveda Store. Your Opportunity to Grow.
          </p>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "MY-SHOPPEE" }]} />

        <Section title="Welcome to MY-SHOPPEE">
          <div className={`${PROSE} space-y-4`}>
            <p>
              MY-SHOPPEE is an online shopping and business platform offering quality Ayurveda
              health and beauty products to customers worldwide. Our platform combines the
              convenience of online shopping with the opportunity for individuals to build their
              own online business.
            </p>
            <p>
              Whether you are a customer looking for Ayurveda products, an entrepreneur
              interested in online business, or someone wishing to become a distributor,
              MY-SHOPPEE provides an opportunity to be part of our growing network.
            </p>
            <p className="font-bold">
              Shop online. Promote products. Build your business. Earn through sales.
            </p>
          </div>
        </Section>

        <Section title="How does MY-SHOPPEE work?">
          <p className={PROSE}>MY-SHOPPEE operates through three levels:</p>
          <ol className="mt-4 grid max-w-4xl gap-4 md:grid-cols-3">
            {LEVELS.map(({ title, body }, i) => (
              <li key={title} className="rounded-lg border border-[#d5d9d9] bg-white p-4 shadow-sm sm:p-5">
                <span className="flex size-8 items-center justify-center rounded-full bg-[#ffd814] text-sm font-bold text-[#0f1111]">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-base font-bold text-[#0f1111]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#0f1111]">{body}</p>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="Become a MY-SHOPPEE Shop Owner" subtitle="Start Your Own Online Business">
          <p className={PROSE}>
            Interested in starting an online business without establishing a physical retail
            outlet? MY-SHOPPEE offers an opportunity to become an independent online Shop Owner.
            Choose an available business participation level, receive your Shop Code and start
            promoting MY-SHOPPEE products.
          </p>
          <SubHeading>Shop Owner Participation Benefits</SubHeading>
          <PlanTable
            {...SHOP_OWNER_BENEFITS}
            caption="The above participation levels and benefits are based on the MY-SHOPPEE business plan. Please refer to the applicable terms and conditions."
          />
        </Section>

        <Section
          title="Become a MY-SHOPPEE Distributor"
          subtitle="Grow Your Business Through Online Distribution"
        >
          <p className={PROSE}>
            Are you interested in marketing Ayursanthi Ayurveda products and expanding your
            business network? MY-SHOPPEE offers an opportunity to become an affiliated
            Distributor.
          </p>
          <p className={`${PROSE} mt-4`}>As a Distributor, you will receive:</p>
          <ul className={`${PROSE} mt-2 list-disc space-y-1 pl-6`}>
            {DISTRIBUTOR_GETS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className={`${PROSE} mt-4`}>
            Our online distribution model is designed to help individuals and business partners
            participate in the growing Ayurveda product market.
          </p>

          <SubHeading>Distributor Participation Benefits</SubHeading>
          <PlanTable {...DISTRIBUTOR_BENEFITS} caption="Other product lines will be added soon." />
        </Section>

        <Section title="Online Distribution Price List" subtitle="Special Distributor Pricing">
          <div className={`${PROSE} space-y-4`}>
            <p>MY-SHOPPEE provides different pricing levels based on the applicable benefit percentage.</p>
            <p>The following table presents the product prices in AED as specified in the business plan.</p>
          </div>
          <PlanTable
            {...PRICE_LIST}
            caption="All prices are in UAE Dirhams (AED). Applicable pricing and benefits are subject to the company's business policies."
          />
        </Section>

        <Section title="Terms & Conditions">
          <p className={PROSE}>
            To ensure transparency, accountability and smooth business operations, all
            MY-SHOPPEE Shop Owners and Distributors must follow the terms and conditions outlined
            below.
          </p>
          <ol className="mt-2 max-w-4xl">
            {TERMS.map(({ title, paragraphs }, i) => (
              <li key={title}>
                <SubHeading>
                  {i + 1}. {title}
                </SubHeading>
                <div className={`${PROSE} mt-2 space-y-3`}>
                  {paragraphs.map((text, j) => (
                    <p key={j}>{text}</p>
                  ))}
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <section className="py-8 sm:py-10">
          <h2 className="text-xl font-bold uppercase tracking-tight text-[#0f1111] sm:text-2xl">
            Be part of the MY-SHOPPEE network
          </h2>
          <p className="mt-1 text-base font-semibold text-[#565959] sm:text-lg">
            Your Interest. Your Initiative. Your Business Opportunity.
          </p>
          <div className={`${PROSE} mt-4 space-y-4`}>
            <p>
              Join MY-SHOPPEE and become part of an online platform dedicated to Ayurveda health
              and beauty products. Whether you wish to shop for quality products, operate your
              own online shop or develop a distribution business, MY-SHOPPEE welcomes you to
              explore the opportunities available.
            </p>
            <p className="font-bold">Start your journey with MY-SHOPPEE today!</p>
          </div>

          <div className="mt-6 grid max-w-xl grid-cols-2 gap-3 sm:gap-4 lg:gap-5">
            {SHOP_CARDS.map((card) => (
              <ShortcutCard key={card.href} {...card} sizes="(max-width: 640px) 50vw, 288px" />
            ))}
          </div>

          <div className={`${PROSE} mt-6 space-y-4`}>
            <p>Stay tuned</p>
            <p>
              <Link href="/" className="font-semibold text-[#007185] hover:underline">
                www.ayurshoppee.ae
              </Link>
            </p>
            <p className="italic text-[#565959]">
              MY-SHOPPEE – Bringing Ayursanthi Ayurveda Products and Business Opportunities
              Closer to You.
            </p>
          </div>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
