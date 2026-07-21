"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue } from "motion/react";
import { Gift, Sparkles } from "lucide-react";

// RewardFloatingButton — a small, draggable shortcut to the gift / reward
// section. It watches the on-page `#reward-gift-section` (the GiftDrawBlock
// block in the hero) with an IntersectionObserver:
//   • while that section is OUT of view → the floating icon is shown, so the
//     reward stays one tap away as the visitor scrolls the rest of the page.
//   • once the section scrolls INTO view → the icon hides (you're already
//     looking at the real thing, no need for the shortcut).
// The icon is draggable anywhere on screen; a plain tap (no drag) smooth-
// scrolls back up to the reward section. Works the same on laptop and mobile.
//
// Positioning note: the icon is placed with `left`/`top` motion values (not
// `bottom`/`right`). Motion's drag-constraint math assumes a top/left origin,
// so anchoring from the opposite corner makes it mis-measure the allowed
// travel — which previously left the icon draggable only "up to a point" on
// larger viewports. Anchoring top/left + explicit numeric constraints lets it
// reach every edge of the screen.
export function RewardFloatingButton({
  targetId = "reward-gift-section",
  label = "Rewards",
}) {
  // true → the target section is currently visible in the viewport.
  const [inView, setInView] = useState(false);
  // Tracks whether the last pointer interaction was a drag, so a drag doesn't
  // also fire the "scroll to section" tap handler.
  const draggingRef = useRef(false);
  // The draggable button, measured to compute its resting position + bounds.
  const buttonRef = useRef(null);
  // Live position (top/left in px) as motion values so dragging is smooth and
  // doesn't fight React state.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  // Numeric pixel bounds keeping the icon fully on-screen at every edge.
  const [constraints, setConstraints] = useState(null);
  // Once the icon has been moved by the user, we stop auto-snapping it to the
  // default corner on resize so we don't yank it out from under them.
  const movedRef = useRef(false);
  // Drives the hover-reveal label pill (desktop) — kept in state so the pill can
  // animate in/out independently of Motion's whileHover scale on the orb.
  const [hovered, setHovered] = useState(false);

  // Default resting spot: bottom-right corner with a comfortable margin.
  const placeDefault = useCallback(() => {
    const el = buttonRef.current;
    if (!el || typeof window === "undefined") return;
    // offsetWidth/Height ignore the mount-in scale transform, so the resting
    // spot is computed from the icon's true layout size.
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const margin = window.innerWidth >= 640 ? 28 : 20; // matches sm:* spacing
    x.set(window.innerWidth - width - margin);
    y.set(window.innerHeight - height - margin);
  }, [x, y]);

  // Recompute the on-screen bounds (and clamp the current position into them).
  const recompute = useCallback(() => {
    const el = buttonRef.current;
    if (!el || typeof window === "undefined") return;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const maxX = Math.max(0, window.innerWidth - width);
    const maxY = Math.max(0, window.innerHeight - height);
    setConstraints({ left: 0, top: 0, right: maxX, bottom: maxY });

    if (movedRef.current) {
      // Keep a user-positioned icon visible if the window shrank.
      x.set(Math.min(Math.max(x.get(), 0), maxX));
      y.set(Math.min(Math.max(y.get(), 0), maxY));
    } else {
      placeDefault();
    }
  }, [placeDefault, x, y]);

  // Track whether the reward section is on screen. We re-query the element on
  // every (rAF-throttled) scroll/resize rather than observing it once, because
  // the section lives inside an async-loading client component (GiftDrawBlock)
  // that mounts a beat after this button — a one-shot IntersectionObserver could
  // miss it, which left the icon stuck hidden on mobile (where the section
  // starts below the fold). A bounding-rect check is immune to that timing.
  useEffect(() => {
    let raf = 0;

    const check = () => {
      const target = document.getElementById(targetId);
      if (!target) {
        setInView(false);
        return;
      }
      const rect = target.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      // In view if any part of the section overlaps the viewport.
      setInView(rect.top < vh && rect.bottom > 0);
    };

    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        check();
      });
    };

    // Settle the initial state across the first second so it's correct even
    // before any scroll — the reward section paints a beat after this mounts.
    check();
    const settleTimers = [
      requestAnimationFrame(check),
      setTimeout(check, 300),
      setTimeout(check, 1000),
    ];

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
      cancelAnimationFrame(settleTimers[0]);
      clearTimeout(settleTimers[1]);
      clearTimeout(settleTimers[2]);
    };
  }, [targetId]);

  // Position + bounds depend on the rendered button size, so measure after the
  // icon mounts (it only renders while the section is out of view) and on resize.
  useLayoutEffect(() => {
    if (inView) return; // button not mounted while the section is on screen
    recompute();
    window.addEventListener("resize", recompute);
    return () => window.removeEventListener("resize", recompute);
  }, [inView, recompute]);

  const scrollToSection = () => {
    if (draggingRef.current) return; // it was a drag, not a tap
    const target = document.getElementById(targetId);
    if (target) target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    // Full-screen, non-interactive layer that holds the icon above the page.
    <div className="pointer-events-none fixed inset-0 z-50">
      <AnimatePresence>
        {!inView ? (
          <motion.div
            ref={buttonRef}
            // Draggable anywhere within the viewport (numeric bounds below).
            drag
            dragMomentum={false}
            dragElastic={0}
            dragConstraints={constraints ?? undefined}
            style={{ x, y }}
            onDragStart={() => {
              draggingRef.current = true;
              movedRef.current = true;
            }}
            // Reset after the click event has had a chance to fire.
            onDragEnd={() => {
              setTimeout(() => {
                draggingRef.current = false;
              }, 0);
            }}
            // NOTE: do not animate `x`/`y` here — those motion values drive the
            // drag position via `style`, and a conflicting `animate` would snap
            // the icon to the top-left/top of the screen. Entrance uses only
            // opacity + scale.
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            className="pointer-events-auto absolute left-0 top-0 flex cursor-grab touch-none select-none flex-col items-center gap-1 active:cursor-grabbing"
          >
            {/* Hover-reveal label pill — slides out to the left of the orb. */}
            <AnimatePresence>
              {hovered ? (
                <motion.span
                  initial={{ opacity: 0, x: 8, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 8, scale: 0.9 }}
                  transition={{ duration: 0.18 }}
                  className="pointer-events-none absolute right-full top-4 mr-3 whitespace-nowrap rounded-full bg-white px-3.5 py-2 text-xs font-bold text-[#0f1111] shadow-lg shadow-black/20 ring-1 ring-[#d5d9d9]"
                >
                  Tap to claim your {label.toLowerCase()}
                  {/* Little arrow joining the pill to the orb. */}
                  <span className="absolute right-[-5px] top-1/2 size-2.5 -translate-y-1/2 rotate-45 bg-white" />
                </motion.span>
              ) : null}
            </AnimatePresence>

            <motion.button
              type="button"
              aria-label={`Go to ${label}`}
              onClick={scrollToSection}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.08 }}
              transition={{ type: "spring", stiffness: 400, damping: 22 }}
              className="group relative grid size-16 place-items-center rounded-full"
            >
              {/* Outermost soft glow that breathes to draw the eye. */}
              <motion.span
                aria-hidden
                animate={{ opacity: [0.35, 0.7, 0.35], scale: [1, 1.18, 1] }}
                transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 -z-20 rounded-full bg-[#ffa41c] blur-xl"
              />

              {/* Rotating conic-gradient ring (navy → gold → navy) — the
                  "advanced" energy halo framing the orb. */}
              <motion.span
                aria-hidden
                animate={{ rotate: 360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 0deg, #232f3e, #ffa41c, #ffd814, #ffffff, #ffa41c, #232f3e)",
                  WebkitMask:
                    "radial-gradient(circle, transparent 56%, #000 58%)",
                  mask: "radial-gradient(circle, transparent 56%, #000 58%)",
                }}
              />

              {/* The glassy inner orb that holds the gift. */}
              <span className="relative grid size-[52px] place-items-center overflow-hidden rounded-full bg-linear-to-br from-[#232f3e] to-[#131921] text-white shadow-xl shadow-black/20 ring-2 ring-white/80">
                {/* Diagonal shimmer sweep across the orb face. */}
                <motion.span
                  aria-hidden
                  initial={{ x: "-120%" }}
                  animate={{ x: "120%" }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    repeatDelay: 2.4,
                    ease: "easeInOut",
                  }}
                  className="absolute inset-0 w-1/2 skew-x-[-20deg] bg-linear-to-r from-transparent via-white/55 to-transparent"
                />
                <motion.span
                  aria-hidden
                  animate={{ rotate: [0, -8, 8, 0] }}
                  transition={{
                    duration: 1.4,
                    repeat: Infinity,
                    repeatDelay: 1.6,
                    ease: "easeInOut",
                  }}
                >
                  <Gift className="size-7 drop-shadow" />
                </motion.span>
              </span>

              {/* Twinkling sparkles orbiting the orb. */}
              <motion.span
                aria-hidden
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, 90] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -right-0.5 -top-0.5 text-[#facc15]"
              >
                <Sparkles className="size-4 fill-[#facc15]" />
              </motion.span>
              <motion.span
                aria-hidden
                animate={{ scale: [0, 1, 0], opacity: [0, 1, 0], rotate: [0, -90] }}
                transition={{
                  duration: 2.2,
                  repeat: Infinity,
                  delay: 1,
                  ease: "easeInOut",
                }}
                className="absolute -bottom-1 -left-1 text-white"
              >
                <Sparkles className="size-3 fill-white" />
              </motion.span>

              {/* Gold "reward ready" notification dot. */}
              <span className="absolute right-0 top-0 grid size-4 place-items-center">
                <span className="absolute size-4 animate-ping rounded-full bg-[#facc15]/70" />
                <span className="relative size-2.5 rounded-full bg-[#facc15] ring-2 ring-white" />
              </span>
            </motion.button>

            {/* Always-visible caption. On touch devices there's no hover to
                reveal the pill above, so this keeps the orb readable as a
                reward shortcut. Hidden on sm+ where the hover pill takes over. */}
            <motion.button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={scrollToSection}
              className="pointer-events-auto -mt-0.5 rounded-full bg-[#232f3e] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white shadow-md shadow-black/20 ring-1 ring-white/60 sm:hidden"
            >
              {label}
            </motion.button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
