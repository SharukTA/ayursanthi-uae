import { Truck, Banknote, BellRing } from "lucide-react";

// The delivery box on a product page. Deliberately carries no date estimate:
// fulfilment is handed to an external courier, so the store has no schedule it
// can honestly promise a shopper. What it can promise is what it controls —
// Cash on Delivery, UAE-wide shipping, and an email at every fulfilment step
// (see STATUS_COPY in lib/email-orders.js).
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
          <Banknote className="size-4 shrink-0 text-emerald-700" />
          Cash on Delivery available
        </p>
        <p className="flex items-center gap-2 text-[#565959]">
          <BellRing className="size-4 shrink-0 text-emerald-700" />
          We email you when your order ships and when it&apos;s out for delivery
        </p>
      </div>
    </div>
  );
}
