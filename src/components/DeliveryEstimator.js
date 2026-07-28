"use client";

import { useEffect, useState } from "react";
import { MapPin, Truck, Banknote } from "lucide-react";

// Amazon/Flipkart-style "Deliver to <pincode>" box. The shopper enters a 6-digit
// Indian PIN and gets an estimated delivery window plus the Cash on Delivery promise.
// The estimate is intentionally a simple client-side window (no carrier API), so
// it's framed as an estimate; the last-used pincode is remembered like Amazon.
const STORAGE_KEY = "ayursanthi_pincode";

function formatDate(date) {
  return date.toLocaleDateString("en-AE", { weekday: "short", day: "numeric", month: "short" });
}

// A friendly 3–6 day window from today, skipping nothing fancy — just a range.
function estimateWindow() {
  const start = new Date();
  start.setDate(start.getDate() + 3);
  const end = new Date();
  end.setDate(end.getDate() + 6);
  return { start, end };
}

export function DeliveryEstimator() {
  const [pincode, setPincode] = useState("");
  const [checked, setChecked] = useState(null); // the confirmed pincode
  const [error, setError] = useState("");

  // Restore the last pincode the shopper used, so the estimate persists like
  // Amazon's remembered delivery location. This MUST run in an effect (not a
  // lazy initializer): localStorage is unavailable during SSR, so reading it on
  // mount is the only way to keep the first client render matching the server
  // and avoid a hydration mismatch. The synchronous setState here is intentional
  // and one-shot, hence the rule is disabled for this block.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && /^\d{6}$/.test(saved)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPincode(saved);
        setChecked(saved);
      }
    } catch {
      // ignore unavailable storage
    }
  }, []);

  function check(e) {
    e?.preventDefault();
    if (!/^\d{6}$/.test(pincode)) {
      setError("Enter a valid 6-digit pincode");
      setChecked(null);
      return;
    }
    setError("");
    setChecked(pincode);
    try {
      localStorage.setItem(STORAGE_KEY, pincode);
    } catch {
      // ignore unavailable storage
    }
  }

  const { start, end } = estimateWindow();

  return (
    <div className="mt-6 rounded-md border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-[#0f1111]">
        <MapPin className="size-4 text-emerald-700" />
        Delivery Options
      </div>

      <form onSubmit={check} className="mt-3 flex items-center gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={pincode}
          onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="Enter delivery pincode"
          className="w-full min-w-0 rounded-md border border-border bg-white px-3 py-2 text-sm text-[#0f1111] outline-none focus:border-emerald-700"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50"
        >
          Check
        </button>
      </form>

      {error ? <p className="mt-2 text-xs font-semibold text-[#e11d48]">{error}</p> : null}

      {checked && !error ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3 text-xs">
          <p className="flex items-center gap-2 text-[#0f1111]">
            <Truck className="size-4 text-emerald-700" />
            <span>
              Estimated delivery to <span className="font-bold">{checked}</span>:{" "}
              <span className="font-bold text-emerald-800">
                {formatDate(start)} – {formatDate(end)}
              </span>
            </span>
          </p>
          <p className="flex items-center gap-2 text-[#565959]">
            <Banknote className="size-4 text-emerald-700" />
            Cash on Delivery available
          </p>
        </div>
      ) : null}
    </div>
  );
}
