// The row of accepted-payment marks shown at checkout.
//
// Its job is to answer a question the shopper asks right before they commit:
// "what happens when I press this?" Payment leaves the site for Stripe's page,
// and an unannounced jump to an unfamiliar domain is exactly where people stop.
// Showing the marks first makes the redirect expected rather than alarming.
//
// These are built from brand colours and typography, not from the networks'
// official artwork. The Mastercard mark is the real construction — two circles
// with the overlap drawn on top — but Visa, Amex, Apple Pay, Google Pay and Link
// are wordmarks set in their brand colours rather than their licensed logotypes.
// Redrawing those by hand produces artwork that is subtly wrong, which reads as
// less trustworthy than clean type, and Apple in particular requires its own
// supplied mark rather than an imitation.
//
// To use the official artwork: drop the SVGs into /public/payment/ and replace
// the corresponding entry below with an <img>. Stripe publishes an approved set,
// and each network has its own rules on clear space and minimum size.
//
// Which methods a shopper is actually offered is decided by Stripe from their
// device and browser — Apple Pay on Safari, Google Pay on Chrome, Link if they
// have used it before — so this row is what the store accepts, not a promise
// about what any one person will see.

// White lettering is written as an arbitrary value, never as `text-white`.
// globals.css remaps the .text-white utility to Amazon ink so light text stays
// readable on the white page, which would paint these two dark-on-dark and
// leave the marks invisible. See the WHITE-PAGE TEXT LEGIBILITY block there.
const CHIP = "flex h-6 items-center justify-center rounded border px-1.5";

function Visa() {
  return (
    <span className={`${CHIP} border-[#d5d9d9] bg-white`}>
      <span className="text-[11px] font-black italic leading-none tracking-tight text-[#1434CB]">
        VISA
      </span>
    </span>
  );
}

function Mastercard() {
  return (
    <span className={`${CHIP} gap-1 border-[#d5d9d9] bg-white`}>
      {/* The genuine construction: a red and a yellow circle, with the lens
          where they overlap painted on top in orange. */}
      <svg viewBox="0 0 30 20" className="h-3.5 w-auto" aria-hidden="true">
        <circle cx="11" cy="10" r="8.5" fill="#EB001B" />
        <circle cx="19" cy="10" r="8.5" fill="#F79E1B" />
        <path
          d="M15 3.6a8.5 8.5 0 0 0 0 12.8 8.5 8.5 0 0 0 0-12.8Z"
          fill="#FF5F00"
        />
      </svg>
      <span className="text-[8px] font-bold leading-none tracking-tight text-[#3f4545]">
        mastercard
      </span>
    </span>
  );
}

function Amex() {
  return (
    <span className={`${CHIP} border-[#006FCF] bg-[#006FCF]`}>
      <span className="text-[10px] font-black leading-none tracking-tight text-[#ffffff]">AMEX</span>
    </span>
  );
}

function ApplePay() {
  return (
    <span className={`${CHIP} border-[#0f1111] bg-[#0f1111]`}>
      <span className="text-[10px] font-semibold leading-none tracking-tight text-[#ffffff]">
        Apple Pay
      </span>
    </span>
  );
}

function GooglePay() {
  return (
    <span className={`${CHIP} gap-[3px] border-[#d5d9d9] bg-white`}>
      <span className="text-[11px] font-bold leading-none text-[#4285F4]">G</span>
      <span className="text-[10px] font-semibold leading-none tracking-tight text-[#5F6368]">
        Pay
      </span>
    </span>
  );
}

function Link() {
  return (
    <span className={`${CHIP} border-[#00D66F] bg-[#00D66F]`}>
      <span className="text-[10px] font-bold leading-none tracking-tight text-[#0f1111]">link</span>
    </span>
  );
}

const MARKS = [
  { name: "Visa", Mark: Visa },
  { name: "Mastercard", Mark: Mastercard },
  { name: "American Express", Mark: Amex },
  { name: "Apple Pay", Mark: ApplePay },
  { name: "Google Pay", Mark: GooglePay },
  { name: "Link", Mark: Link },
];

export function PaymentMarks({ className = "" }) {
  return (
    <ul
      className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}
      aria-label="Accepted payment methods"
    >
      {MARKS.map(({ name, Mark }) => (
        // The name is carried on the list item rather than inside the mark, so a
        // screen reader announces "Visa" once instead of reading the decorative
        // lettering back as content.
        <li key={name} title={name}>
          <span className="sr-only">{name}</span>
          <Mark />
        </li>
      ))}
    </ul>
  );
}
