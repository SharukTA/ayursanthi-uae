
"use client";

import { motion, useReducedMotion } from "motion/react";

/**
 * Logo3D — renders the Ayursanthi logo with a continuous 3D sway
 * and a hover tilt. No background — the SVG sits directly on the navbar.
 */
export function Logo3D({
  src = "/logo.svg",
  alt = "Ayursanthi",
  size = 56,
  scale = 1,
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center"
        style={{ width: size, height: size }}
      >
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="block object-contain"
          style={{
            width: size,
            height: size,
            transform: `scale(${scale})`,
            filter: "drop-shadow(0 6px 14px rgba(12,38,38,0.28))",
          }}
        />
      </span>
    );
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        perspective: 600,
        width: size,
        height: size,
        // Visually enlarge without changing layout footprint
        transform: `scale(${scale})`,
        transformOrigin: "center",
      }}
    >
      <motion.img
        src={src}
        alt={alt}
        width={size}
        height={size}
        draggable={false}
        className="block object-contain"
        style={{
          width: size,
          height: size,
          transformStyle: "preserve-3d",
          filter: "drop-shadow(0 7px 16px rgba(12,38,38,0.3))",
        }}
        // Idle: gentle continuous Y-axis sway
        animate={{ rotateY: [-12, 12, -12], rotateX: [3, -3, 3] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        // Hover: lean forward and scale up
        whileHover={{
          rotateY: 25,
          rotateX: -10,
          scale: 1.12,
          transition: { type: "spring", stiffness: 260, damping: 16 },
        }}
        // Tap/click: full coin flip
        whileTap={{
          rotateY: 360,
          transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] },
        }}
      />
    </span>
  );
}
