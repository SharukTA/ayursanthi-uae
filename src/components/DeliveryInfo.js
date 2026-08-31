import { Truck, ShieldCheck, BellRing } from "lucide-react";

// The delivery box on a product page. Deliberately carries no date estimate and
// no promise of tracking updates: fulfilment is handed to an external courier
// the moment payment clears, and the parcel lives under their AWB number after
// that. The store has neither a schedule nor a status feed it could honestly
// offer. What it can promise is what it controls — UAE-wide shipping, secure
// payment, and a confirmation the instant the money is in.
export function DeliveryInfo() {
  return (
    <div className="mt-6 rounded-md border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-[#0f1111]">
        <Truck className="size-4 text-emerald-700" />
        Delivery
      </div>

      <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
        <p className="flex items-center gap-2 text-[#0f1111]">
          <Truck className="size-4 shrink-0 text-emerald-700" />
          Shipped across the UAE by our courier partner
        </p>
        <p className="flex items-center gap-2 text-[#565959]">
          <ShieldCheck className="size-4 shrink-0 text-emerald-700" />
          Secure online payment — Card, Apple Pay and Google Pay
        </p>
        <p className="flex items-center gap-2 text-[#565959]">
          <BellRing className="size-4 shrink-0 text-emerald-700" />
          Order confirmation emailed the moment your payment clears
        </p>
      </div>
    </div>
  );
}
