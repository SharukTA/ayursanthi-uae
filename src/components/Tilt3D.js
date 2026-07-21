"use client";

import { useEffect, useRef, useState } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useReducedMotion,
} from "motion/react";

// Touch devices don't have hover → skip the entire tilt effect.
function useIsTouchDevice() {
  const [isTouch, setIsTouch] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouch(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return isTouch;
}

/**
 * Tilt3D — wraps children in a 3D tilt-on-hover card.
 * Mouse position drives rotateX/rotateY with spring smoothing.
 * Optional shine layer that follows the cursor.
 *
 *   <Tilt3D><ProductCard /></Tilt3D>
 */
export function Tilt3D({
  children,
  className = "",
  maxTilt = 12,
  scale = 1.02,
  shine = true,
  perspective = 1000,
}) {
  const reduceMotion = useReducedMotion();
  const isTouch = useIsTouchDevice();
  const ref = useRef(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotateX = useSpring(useMotionValue(0), {
    stiffness: 350,
    damping: 30,
    mass: 0.3,
  });
  const rotateY = useSpring(useMotionValue(0), {
    stiffness: 350,
    damping: 30,
    mass: 0.3,
  });
  // Snappy, critically-damped scale so the card settles fast and the
  // text re-rasterizes sharp almost immediately (blur is worst mid-animation).
  const scaleVal = useSpring(useMotionValue(1), {
    stiffness: 400,
    damping: 34,
    mass: 0.3,
  });

  const shineBg = useMotionTemplate`radial-gradient(420px circle at ${x}px ${y}px, rgba(255,255,255,0.18), transparent 45%)`;

  if (reduceMotion || isTouch) {
    return <div className={className}>{children}</div>;
  }

  const handleMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = (px - cx) / cx; // -1 .. 1
    const dy = (py - cy) / cy;
    rotateY.set(dx * maxTilt);
    rotateX.set(-dy * maxTilt);
    x.set(px);
    y.set(py);
  };

  const handleEnter = () => {
    scaleVal.set(scale);
  };

  const handleLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    scaleVal.set(1);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        rotateX,
        rotateY,
        scale: scaleVal,
        transformStyle: "preserve-3d",
        perspective,
        // Keep text crisp under the 3D transform:
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        WebkitFontSmoothing: "antialiased",
        MozOsxFontSmoothing: "grayscale",
      }}
      className={`relative ${className}`}
    >
      {children}
      {shine && (
        <motion.div
          aria-hidden="true"
          style={{ background: shineBg }}
          className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-soft-light"
        />
      )}
    </motion.div>
  );
}
