import Link from "next/link";
import { FooterAuth } from "@/components/FooterAuth";

export function SiteFooter() {
  // `surface-brand` is what keeps the brand teal alive here — it is the only
  // opted-in teal surface left in the app. The rest of the site is
  // Amazon-neutral, so this can no longer lean on a colour-family mapping and
  // pins the colour itself. See globals.css.
  return (
    <footer className="surface-brand relative border-t border-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_-12px_40px_-20px_rgba(12,38,38,0.6)]">
      {/* Soft gradient seam that fades the footer smoothly into the page above */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-px h-px bg-linear-to-r from-transparent via-white/30 to-transparent"
      />
      <div className="mx-auto flex max-w-7xl justify-center gap-12 px-4 py-10 sm:px-6 md:gap-24 lg:px-8">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Shop
          </h3>
          <div className="mt-4 grid gap-2 text-sm text-slate-300">
            <Link href="/products" className="hover:text-white">
              Products
            </Link>
            <Link href="/categories" className="hover:text-white">
              Categories
            </Link>
            <Link href="/login" className="hover:text-white">
              Your orders
            </Link>
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Support
          </h3>
          <div className="mt-4 grid gap-2 text-sm text-slate-300">
            <Link href="/contact" className="hover:text-white">
              Contact
            </Link>
            <Link href="/faq" className="hover:text-white">
              FAQ
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms
            </Link>
          </div>
        </div>
      </div>

      {/* Amazon-style bottom bar — darker gradient of the brand teal (#156c6b) */}
      <div className="border-t border-white/10 bg-linear-to-b from-[#0c403f] to-[#06201f]">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-6 sm:px-6 lg:px-8">
          <FooterAuth />
          <p className="text-xs text-white">
            &copy; 2026 Ayursanthi Wellness. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
