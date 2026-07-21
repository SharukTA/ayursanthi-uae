"use client";

import { useEffect, useRef, useState } from "react";

// Amazon-mobile behaviour: the search + filter bar sticks to the top of the
// viewport, slides up out of view when the user scrolls DOWN through the long
// product list, and slides back in the moment they scroll UP. Near the very top
// it's always shown. On lg+ the whole thing reverts to a normal, static block
// (the desktop layout keeps its left sidebar instead).
export function ScrollAwareFilters({ children }) {
  const [hidden, setHidden] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    lastY.current = window.scrollY;

    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;

      // Ignore tiny jitters so the bar doesn't flicker.
      if (Math.abs(delta) < 8) return;

      if (y < 120) {
        setHidden(false); // always visible near the top
      } else if (delta > 0) {
        setHidden(true); // scrolling down → hide
      } else {
        setHidden(false); // scrolling up → reveal
      }

      lastY.current = y;
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className={`sticky top-0 z-30 -mx-4 bg-slate-50/95 px-4 pb-2 pt-2 backdrop-blur transition-transform duration-300 ease-out sm:-mx-6 sm:px-6 lg:static lg:z-auto lg:mx-0 lg:translate-y-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none ${
        hidden ? "-translate-y-[150%]" : "translate-y-0"
      }`}
    >
      <div className="flex flex-col gap-3 lg:gap-5">{children}</div>
    </div>
  );
}
