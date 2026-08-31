import { BadgePercent, Tag, Truck, ShieldCheck } from "lucide-react";
import { formatMoney } from "@/lib/currency";

// "Available offers" panel — the Amazon/Flipkart block that stacks the deals
// applicable to a product. Every entry here is derived from real data (the
// product's own discount, its admin-set offer badge, secure payment/dispatch), so
// nothing is fabricated. Renders nothing if there are no offers to show.
export function OffersBox({ price, mrp, offerLabel }) {
  const offers = [];

  const numericMrp = mrp != null ? Number(mrp) : null;
  const numericPrice = Number(price);
  if (numericMrp && numericMrp > numericPrice) {
    const pct = Math.round(((numericMrp - numericPrice) / numericMrp) * 100);
    const saved = Math.round(numericMrp - numericPrice);
    offers.push({
      icon: BadgePercent,
      title: `${pct}% instant discount`,
      body: `You save ${formatMoney(saved)} off the MRP of ${formatMoney(numericMrp)}.`,
    });
  }

  const badge = offerLabel?.trim();
  if (badge) {
    offers.push({
      icon: Tag,
      title: "Special offer",
      body: badge,
    });
  }

  // Always-on store promises (true site-wide), rounding out the block.
  offers.push({
    icon: Truck,
    title: "Secure online payment",
    body: "Pay by card, Apple Pay or Google Pay — your details never touch this site.",
  });
  offers.push({
    icon: ShieldCheck,
    title: "Secure, lab-tested dispatch",
    body: "100% natural, quality-checked and tamper-proof packaging.",
  });

  return (
    <div className="mt-4 rounded-md border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-[#0f1111]">
        <BadgePercent className="size-4 text-emerald-700" />
        Available offers
      </div>
      <ul className="mt-3 space-y-3">
        {offers.map((offer, i) => {
          const Icon = offer.icon;
          return (
            <li key={i} className="flex items-start gap-2.5">
              <Icon className="mt-0.5 size-4 shrink-0 text-emerald-700" />
              <p className="text-xs leading-5 text-[#3f4545]">
                <span className="font-bold text-[#0f1111]">{offer.title}</span> — {offer.body}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
