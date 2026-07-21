"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";

export function LenisProvider({ children }) {
  const lenisRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      touchMultiplier: 1.4,
    });
    lenisRef.current = lenis;

    let rafId;
    function raf(time) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    // Debounced resize — coalesce rapid layout changes (Tilt3D hover,
    // motion reveal completions, etc.) into a single resize call.
    let resizeTimeout;
    const debouncedResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => lenis.resize(), 150);
    };
    const resizeObserver = new ResizeObserver(debouncedResize);
    resizeObserver.observe(document.body);
    window.addEventListener("load", debouncedResize);

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      window.removeEventListener("load", debouncedResize);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  // On route change, do a couple of measured resizes to catch lazy content.
  // We let Next.js handle scroll-to-top naturally — no abrupt jump.
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;

    const timers = [
      setTimeout(() => lenis.resize(), 120),
      setTimeout(() => lenis.resize(), 700),
    ];

    return () => {
      timers.forEach(clearTimeout);
    };
  }, [pathname]);

  return children;
}
