"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Menu, X, Search, ChevronRight, Home as HomeIcon } from "lucide-react";
import { CartBadge } from "@/components/CartBadge";
import { HeaderAuth, MobileHeaderAuth } from "@/components/HeaderAuth";
import { AccountMenu } from "@/components/AccountMenu";
import { Logo3D } from "@/components/Logo3D";
import { useSession } from "@/components/SessionProvider";

const navItems = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Categories" },
  { href: "/products", label: "Products" },
  { href: "/about", label: "About Us" },
  { href: "/contact", label: "Contact" },
  { href: "/faq", label: "FAQ" },
];

// Admins get a trimmed, management-focused nav (no shopper-facing pages).
const adminNavItems = [
  { href: "/", label: "Home" },
  { href: "/categories", label: "Categories" },
  { href: "/products", label: "Products" },
];

// Shared style for the secondary-nav quick links. Tight padding + nowrap so the
// strip stays one dense scrollable row, Amazon-style.
const NAV_LINK =
  "shrink-0 whitespace-nowrap rounded px-2 py-1 text-[13px] font-semibold text-white transition hover:bg-white/10";

const DRAWER_FALLBACK_IMG =
  "https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=200";

function formatPrice(value) {
  return `Rs. ${Number(value).toLocaleString("en-IN")}`;
}

// `transparent` — homepage only. The header sits over the hero's video-tint
// gradient with no background of its own, so the gradient reads from the very
// top of the page down through the carousel. Once the user scrolls past the
// hero the bar fades to solid Amazon navy so it stays legible over content.
export function SiteHeader({ transparent = false }) {
  const pathname = usePathname();
  const { session } = useSession();
  const [scrolled, setScrolled] = useState(false);
  // Distinct from `scrolled` (12px): the transparent homepage bar only fades to
  // solid navy once the user has moved a meaningful distance down the hero, so
  // a 12px nudge doesn't slam a navy bar over the gradient.
  const [pastHeroTop, setPastHeroTop] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Right-side account drawer (the signed-in user's profile menu).
  const [accountOpen, setAccountOpen] = useState(false);
  // Once the full mobile header scrolls out of view, a compact sticky bar
  // (hamburger + search + cart) takes over, Amazon-style.
  const [showMobileBar, setShowMobileBar] = useState(false);
  const mobileHeaderRef = useRef(null);
  // Live catalog data for the Amazon-style mobile bar + drawer. Fetched from the
  // public customer endpoints so the menu mirrors what the admin has published.
  const [categories, setCategories] = useState([]);
  const [latestProducts, setLatestProducts] = useState([]);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 12);
      setPastHeroTop(y > 160);
      // Reveal the compact mobile bar only after the full header has scrolled
      // completely past, so the two never overlap. Fall back to a sane height
      // before the ref measures (e.g. first paint).
      const headerH = mobileHeaderRef.current?.offsetHeight ?? 140;
      setShowMobileBar(y > headerH);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          fetch("/api/categories"),
          fetch("/api/products"),
        ]);
        if (catRes.ok) {
          const data = await catRes.json();
          if (active) setCategories(data.categories || []);
        }
        if (prodRes.ok) {
          const data = await prodRes.json();
          // /api/products already orders newest-first; keep the latest handful.
          if (active) setLatestProducts((data.products || []).slice(0, 6));
        }
      } catch {
        // Network hiccups just leave the menu showing its static fallback links.
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // Lock background scroll while the slide-over drawer is open. We pin the body
  // with `position: fixed` (preserving the current scroll offset) rather than
  // just `overflow: hidden`, because mobile browsers happily keep scrolling the
  // page behind an overflow-hidden body. Only the drawer, which has its own
  // overflow-y-auto + overscroll-contain, stays scrollable.
  useEffect(() => {
    if (!mobileOpen) return;
    const { body, documentElement: html } = document;
    const scrollY = window.scrollY;
    const prev = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      htmlOverflow: html.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    return () => {
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      body.style.overflow = prev.bodyOverflow;
      html.style.overflow = prev.htmlOverflow;
      // Restore the scroll position the user was at before locking.
      window.scrollTo(0, scrollY);
    };
  }, [mobileOpen]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Logging in/out from the home page leaves the pathname unchanged (logout
  // pushes to "/"), so the pathname effect above won't close the drawer. Close
  // it whenever the auth state flips too.
  const isLoggedIn = !!session;
  useEffect(() => {
    setMobileOpen(false);
  }, [isLoggedIn]);

  const isAdmin = session?.role === "ADMIN";
  // Amazon-style: only the home page keeps the secondary quick-links strip and
  // a sticky/compact-bar header. On every other page the header scrolls away
  // for good and the "Shop by category / Deals" strip is hidden.
  const isHome = pathname === "/";

  // The most-recently-added categories, shown inline in the desktop secondary
  // nav next to "Today's Deals" (Amazon-style quick links). The strip scrolls
  // horizontally rather than wrapping, so a few extra links cost no height.
  const latestCategories = [...categories]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 4);

  // On the homepage the bar is see-through while the user is still at the top of
  // the hero, so the video's dominant-colour gradient runs unbroken from behind
  // the nav down through the carousel.
  const isTransparent = transparent && !pastHeroTop;

  return (
    <>
    <motion.header
      initial={false}
      data-transparent={isTransparent ? "true" : "false"}
      animate={{
        boxShadow: isTransparent
          ? "0 0 0 0 rgba(0,0,0,0)"
          : scrolled
            ? "0 1px 0 rgba(255,255,255,0.12) inset, 0 10px 30px -12px rgba(15,17,17,0.45), 0 2px 8px -4px rgba(15,17,17,0.25)"
            : "0 1px 0 rgba(255,255,255,0.08) inset, 0 6px 20px -14px rgba(15,17,17,0.3)",
      }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className={`surface-navy relative top-0 z-50 border-b transition-colors duration-300 sm:sticky ${
        isTransparent
          ? "border-transparent bg-transparent"
          : scrolled
            ? "border-white/10 bg-[#131921]/95 backdrop-blur-md supports-backdrop-filter:bg-[#131921]/90"
            : "border-white/10 bg-[#131921] backdrop-blur-md"
      }`}
    >
      {/* Soft light seam along the bottom edge of the navy bar. Hidden while the
          bar is transparent — a seam there would draw a line across the hero
          gradient we're trying to keep unbroken. */}
      {!isTransparent && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-linear-to-r from-transparent via-white/20 to-transparent"
        />
      )}
      {/* ===== Mobile header — two stacked sections, Amazon-style ===== */}
      <div ref={mobileHeaderRef} className="sm:hidden">
        {/* Top: hamburger + logo on the left, account + cart on the right */}
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 pt-0.5 pb-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="flex size-10 shrink-0 items-center justify-center rounded border border-white/40 text-white transition hover:border-white hover:bg-[#ffffff1a]"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
            <Link href="/" className="flex shrink-0 items-center" aria-label="Ayursanthi home">
              <Logo3D size={72} />
            </Link>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <MobileHeaderAuth onOpenMenu={() => setAccountOpen(true)} />
            {!isAdmin && <CartBadge />}
          </div>
        </div>

        {/* Bottom: full-width search bar */}
        <div className="mx-auto max-w-7xl px-4 pb-2">
          <form action="/products" method="GET" className="flex w-full items-center">
            <div className="flex w-full items-center gap-2 overflow-hidden rounded-full bg-white px-4 shadow-sm ring-1 ring-white/20 transition focus-within:ring-2 focus-within:ring-white/70">
              <button
                type="submit"
                className="flex shrink-0 items-center justify-center text-[#565959] transition hover:text-[#0f1111]"
                aria-label="Search"
              >
                <Search className="size-4.5" />
              </button>
              <input
                type="text"
                name="search"
                placeholder="Search ayursanthi.com"
                aria-label="Search products"
                className="search-bare w-full min-w-0 bg-transparent py-2.5 text-sm text-[#0f1111] outline-none placeholder:text-[#565959]"
              />
            </div>
          </form>
        </div>

        {/* Quick-links strip below the search — Amazon's "Shop by category /
            Deals / …" row. Horizontally scrollable, left-aligned. Home only. */}
        {isHome && (
          <div
            className={
              isTransparent
                ? "border-t border-white/20"
                : "border-t border-white/10 bg-[#232f3e]"
            }
          >
            <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-0.5 overflow-x-auto px-3 py-0.5">
              <Link href="/categories" className={NAV_LINK}>
                Shop by category
              </Link>
              {!isAdmin && (
                <>
                  <Link href="/products" className={NAV_LINK}>
                    Deals
                  </Link>
                  {latestCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/products?category=${cat.slug}`}
                      className={NAV_LINK}
                    >
                      {cat.name}
                    </Link>
                  ))}
                  <Link href="/gifts" className={NAV_LINK}>
                    Gifts &amp; Rewards
                  </Link>
                  <Link href="/contact" className={NAV_LINK}>
                    Customer Service
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ===== Tablet/desktop header — single row ===== */}
      <div className="mx-auto hidden max-w-7xl items-center gap-3 px-4 py-1.5 sm:flex sm:gap-4 sm:px-6 lg:px-8">
        {/* Brand Logo only — no wordmark */}
        <Link href="/" className="flex shrink-0 items-center group">
          <Logo3D size={88} />
        </Link>

        {/* Search bar — centered, Amazon-style */}
        <form
          action="/products"
          method="GET"
          className="mx-auto flex min-w-0 max-w-2xl flex-1 items-center"
        >
          <div className="flex w-full items-center gap-2 overflow-hidden rounded-full bg-white px-4 shadow-sm ring-1 ring-white/20 transition focus-within:ring-2 focus-within:ring-white/70">
            <button
              type="submit"
              className="flex shrink-0 items-center justify-center text-[#565959] transition hover:text-[#0f1111]"
              aria-label="Search"
            >
              <Search className="size-4.5" />
            </button>
            <input
              type="text"
              name="search"
              placeholder="Search ayursanthi.com"
              aria-label="Search products"
              className="search-bare w-full min-w-0 bg-transparent py-2.5 text-sm text-[#0f1111] outline-none placeholder:text-[#565959]"
            />
          </div>
        </form>

        {/* Right cluster — auth then cart at the far right */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <HeaderAuth onOpenMenu={() => setAccountOpen(true)} />
          {!isAdmin && <CartBadge />}
          {/* Tablet menu trigger (links collapse below lg) */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex size-9 items-center justify-center rounded border border-white/30 text-white hover:border-white hover:bg-[#ffffff1a] transition lg:hidden"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

    </motion.header>

      {/* Secondary nav bar — Amazon-style "All" menu. A single hamburger + Home
          trigger opens the same full slide-over drawer the mobile view uses
          (Home, categories, products, info pages…). Kept OUTSIDE the sticky
          header so that on desktop only the search row above stays pinned while
          this strip scrolls away (slides up behind the pinned bar). */}
      <nav
        className={`surface-navy relative z-40 hidden border-t transition-colors duration-300 lg:block ${
          isTransparent
            ? "border-white/20 bg-transparent"
            : "border-white/10 bg-[#232f3e]"
        }`}
      >
        <div className="no-scrollbar mx-auto flex max-w-7xl items-center gap-0.5 overflow-x-auto px-4 py-0.5 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-2 py-1 text-[13px] font-semibold text-white transition hover:bg-white/10"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-4.5" /> : <Menu className="size-4.5" />}
            All
          </button>

          {/* Quick links to the right of the menu: deals, the most-recently
              added categories, then the info pages — Amazon's dense strip. */}
          {!isAdmin && (
            <Link href="/products" className={NAV_LINK}>
              Today&apos;s Deals
            </Link>
          )}
          {latestCategories.map((cat) => (
            <Link
              key={cat.id}
              href={`/products?category=${cat.slug}`}
              className={NAV_LINK}
            >
              {cat.name}
            </Link>
          ))}
          {!isAdmin && (
            <>
              <Link href="/gifts" className={NAV_LINK}>
                Gifts &amp; Rewards
              </Link>
              <Link href="/contact" className={NAV_LINK}>
                Customer Service
              </Link>
              <Link href="/about" className={NAV_LINK}>
                About Us
              </Link>
              <Link href="/faq" className={NAV_LINK}>
                FAQ
              </Link>
            </>
          )}
        </div>
      </nav>

      {/* ===== Mobile/tablet slide-over drawer (Amazon-style) ===== */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Dimmed backdrop — the transparent 1/4 strip to the right of the
                panel. Tapping anywhere on it closes the menu, Amazon-style. */}
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[60] bg-black/50"
            />

            {/* Floating close (X) icon sitting in the transparent strip,
                top-right — mirrors Amazon's mobile menu. */}
            <motion.button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed right-3 top-3 z-80 flex size-10 items-center justify-center rounded-full text-white transition hover:bg-white/15"
            >
              <X className="size-7" />
            </motion.button>

            {/* Sliding panel */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-[70] flex h-dvh w-3/4 max-w-sm flex-col bg-white shadow-2xl"
            >
              {/* Drawer header: account on the top-right. Closing is handled by
                  the floating X in the transparent strip, Amazon-style. When
                  signed in, the account control swaps over to the right-side
                  profile menu instead of jumping to the dashboard. */}
              <div className="surface-navy flex items-center justify-end gap-2 bg-[#232f3e] px-4 py-3">
                <MobileHeaderAuth
                  onOpenMenu={() => {
                    setMobileOpen(false);
                    setAccountOpen(true);
                  }}
                />
              </div>

              {/* Scrollable body. `min-h-0` is required so this flex child can
                  shrink below its content height and actually scroll inside the
                  fixed-height drawer; without it the list overflows off-screen. */}
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
                {/* Home */}
                <Link
                  href="/"
                  className="flex items-center gap-3 px-4 py-3 text-[15px] font-bold text-[#0f1111] transition hover:bg-[#f7fafa]"
                >
                  <HomeIcon className="size-5" />
                  Home
                </Link>

                {isAdmin ? (
                  /* Admins keep their trimmed management nav */
                  <nav className="border-t border-[#d5d9d9] py-1">
                    {adminNavItems
                      .filter((item) => item.href !== "/")
                      .map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center justify-between px-4 py-3 text-[15px] font-semibold text-[#0f1111] transition hover:bg-[#f7fafa]"
                        >
                          {item.label}
                          <ChevronRight className="size-4 text-[#565959]" />
                        </Link>
                      ))}
                  </nav>
                ) : (
                  <>
                    {/* Top categories for you */}
                    <div className="border-t border-[#d5d9d9] pt-3">
                      <h3 className="px-4 pb-1 text-base font-bold text-[#0f1111]">
                        Top categories for you
                      </h3>
                      {categories.length > 0 ? (
                        <>
                          {categories.map((cat) => (
                            <Link
                              key={cat.id}
                              href={`/products?category=${cat.slug}`}
                              className="flex items-center justify-between px-4 py-2.5 text-[15px] font-medium text-[#0f1111] transition hover:bg-[#f7fafa]"
                            >
                              {cat.name}
                              <ChevronRight className="size-4 text-[#565959]" />
                            </Link>
                          ))}
                          <Link
                            href="/categories"
                            className="block px-4 py-2.5 text-sm font-bold text-[#0f1111] underline-offset-2 hover:underline"
                          >
                            See all categories
                          </Link>
                        </>
                      ) : (
                        <p className="px-4 py-2 text-sm text-[#565959]">
                          No categories yet.
                        </p>
                      )}
                    </div>

                    {/* Products for you — latest 5-6, Amazon-style list. The
                        heading doubles as a button to the full catalog. */}
                    <div className="mt-1 border-t border-[#d5d9d9] pt-3">
                      <Link
                        href="/products"
                        className="mx-4 mb-1 flex items-center justify-between gap-2 rounded-md bg-[#232f3e] px-3 py-2 text-base font-bold text-white transition hover:bg-[#131921]"
                      >
                        Products for you
                        <ChevronRight className="size-5 shrink-0" />
                      </Link>
                      {latestProducts.length > 0 ? (
                        <>
                          {latestProducts.map((product) => {
                            const primaryMedia = product.images?.[0];
                            const isVideo = primaryMedia?.mediaType === "VIDEO";
                            const imageUrl = primaryMedia?.url || DRAWER_FALLBACK_IMG;
                            return (
                              <Link
                                key={product.id}
                                href={`/products/${product.slug}`}
                                className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-[#f7fafa]"
                              >
                                {isVideo ? (
                                  <video
                                    src={imageUrl}
                                    muted
                                    loop
                                    autoPlay
                                    playsInline
                                    preload="metadata"
                                    className="size-12 shrink-0 rounded-md border border-[#d5d9d9] object-cover"
                                  />
                                ) : (
                                  <span
                                    className="size-12 shrink-0 rounded-md border border-[#d5d9d9] bg-cover bg-center"
                                    style={{ backgroundImage: `url('${imageUrl}')` }}
                                  />
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-[#0f1111]">
                                    {product.name}
                                  </span>
                                  <span className="mt-0.5 block text-sm font-bold text-[#0f1111]">
                                    {formatPrice(product.price)}
                                  </span>
                                </span>
                                <ChevronRight className="size-4 shrink-0 text-[#565959]" />
                              </Link>
                            );
                          })}
                          <Link
                            href="/products"
                            className="block px-4 py-2.5 text-sm font-bold text-[#0f1111] underline-offset-2 hover:underline"
                          >
                            See all products
                          </Link>
                        </>
                      ) : (
                        <p className="px-4 py-2 text-sm text-[#565959]">
                          No products yet.
                        </p>
                      )}
                    </div>

                    {/* Remaining info pages */}
                    <nav className="mt-1 border-t border-[#d5d9d9] py-1">
                      {navItems
                        .filter(
                          (item) =>
                            !["/", "/categories", "/products"].includes(
                              item.href
                            )
                        )
                        .map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            className="flex items-center justify-between px-4 py-3 text-[15px] font-semibold text-[#0f1111] transition hover:bg-[#f7fafa]"
                          >
                            {item.label}
                            <ChevronRight className="size-4 text-[#565959]" />
                          </Link>
                        ))}
                    </nav>
                  </>
                )}

                {/* Account actions for signed-in users (logout etc.) */}
                {isLoggedIn && (
                  <div className="mt-1 border-t border-[#d5d9d9] px-4 py-3">
                    <HeaderAuth />
                  </div>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

    {/* ===== Mobile compact sticky bar — slides in once the full header has
        scrolled away. Hamburger + search + cart only, Amazon-style. Rendered
        OUTSIDE the header on purpose: the header's `backdrop-blur` creates a
        containing block, which would otherwise pin this `fixed` bar to the
        header (and let it scroll off-screen) instead of the viewport. ===== */}
    <AnimatePresence>
      {showMobileBar && isHome && (
        <motion.div
          initial={{ y: "-100%" }}
          animate={{ y: 0 }}
          exit={{ y: "-100%" }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="surface-navy fixed inset-x-0 top-0 z-50 border-b border-white/10 bg-[#131921] shadow-[0_8px_24px_-12px_rgba(15,17,17,0.6)] sm:hidden"
        >
          <div className="mx-auto flex max-w-7xl items-center gap-2 px-3 py-2">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="flex size-10 shrink-0 items-center justify-center rounded border border-white/40 text-white transition hover:border-white hover:bg-[#ffffff1a]"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
            <form
              action="/products"
              method="GET"
              className="flex min-w-0 flex-1 items-center"
            >
              <div className="flex w-full items-center gap-2 overflow-hidden rounded-full bg-white px-4 shadow-sm ring-1 ring-white/20 transition focus-within:ring-2 focus-within:ring-white/70">
                <button
                  type="submit"
                  className="flex shrink-0 items-center justify-center text-[#565959] transition hover:text-[#0f1111]"
                  aria-label="Search"
                >
                  <Search className="size-4.5" />
                </button>
                <input
                  type="text"
                  name="search"
                  placeholder="Search ayursanthi.com"
                  aria-label="Search products"
                  className="search-bare w-full min-w-0 bg-transparent py-2.5 text-sm text-[#0f1111] outline-none placeholder:text-[#565959]"
                />
              </div>
            </form>
            {!isAdmin && <CartBadge />}
          </div>
        </motion.div>
      )}
    </AnimatePresence>

    {/* Right-side account/profile drawer, opened by the header user control.
        Its "Browse" button swaps over to the left hamburger menu. */}
    <AccountMenu
      open={accountOpen}
      onClose={() => setAccountOpen(false)}
      onBrowse={() => {
        setAccountOpen(false);
        setMobileOpen(true);
      }}
    />
    </>
  );
}
