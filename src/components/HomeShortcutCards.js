import Image from "next/image";
import Link from "next/link";

// Photos from Pexels (free for commercial use, no credit required), kept in public/ so
// they do not depend on another site staying up. `focus` keeps the subject in the crop.
// The shop cards that used to sit here now live on /my-shoppee, reached from the footer.
const CARDS = [
  {
    href: "/online-consultation",
    label: "Online Consultation",
    image: "/images/home-cards/consultation.jpg", // pexels.com/photo/8376177
    focus: "65% 45%",
    // Alone on its row: spans both columns, then shrinks back to one card's width
    // (half the row, less half of the gap at each breakpoint) and sits in the middle.
    placement:
      "col-span-2 justify-self-center w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.5rem)] lg:w-[calc(50%-0.625rem)]",
  },
];

// A photo over the site's yellow primary action, the same as FaceVideoCarousel's.
// The photo has empty alt text because the button inside the same link already says
// where it goes.
export function ShortcutCard({ href, label, image, focus, sizes, className = "" }) {
  return (
    <Link
      href={href}
      className={`group flex flex-col overflow-hidden rounded-lg border border-[#d5d9d9] bg-white shadow-sm transition hover:shadow-md ${className}`}
    >
      <span className="relative block aspect-3/2 w-full">
        <Image
          src={image}
          alt=""
          fill
          sizes={sizes}
          className="object-cover"
          style={{ objectPosition: focus }}
        />
      </span>
      <span className="m-3 flex min-h-10 items-center justify-center rounded-full border border-[#fcd200] bg-[#ffd814] px-3 py-2 text-center text-sm font-bold text-[#0f1111] shadow-md transition-colors group-hover:bg-[#f7ca00]">
        {label}
      </span>
    </Link>
  );
}

// The way into these pages from the site's navigation: they are deliberately absent
// from the header and the menu.
//
// Two columns, each card one New Arrivals card wide at every breakpoint (half the
// row on phones and tablets, a quarter from lg), so they line up as a smaller
// companion to the strip above.
export function HomeShortcutCards() {
  return (
    <section className="relative z-10 mx-auto mt-6 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="mx-auto grid grid-cols-2 gap-3 sm:gap-4 lg:w-[calc(50%-0.625rem)] lg:gap-5">
        {CARDS.map(({ placement = "", ...card }) => (
          <ShortcutCard
            key={card.href}
            {...card}
            sizes="(max-width: 1024px) 50vw, 25vw"
            className={placement}
          />
        ))}
      </div>
    </section>
  );
}
