"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

/**
 * ShatterImage — splits an image into a rows×cols grid of tiles.
 * On scroll into view, the tiles fly in from scattered positions and
 * reassemble into the full picture. On hover, tiles slightly break apart.
 *
 * Usage:
 *   <ShatterImage src="/hero.jpg" alt="..." rows={4} cols={5} />
 */
export function ShatterImage({
  src,
  alt = "",
  rows = 4,
  cols = 5,
  className = "",
  reverseOnExit = false,
}) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tiles = useMemo(() => {
    const list = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const seed = r * cols + c;
        // Deterministic pseudo-random offsets per tile.
        // Rounded so SSR string == client string (avoids hydration mismatch).
        const angle = (seed * 137.5) % 360;
        const distance = 240 + ((seed * 53) % 220);
        const rad = (angle * Math.PI) / 180;
        list.push({
          row: r,
          col: c,
          dx: Math.round(Math.cos(rad) * distance),
          dy: Math.round(Math.sin(rad) * distance),
          rotate: ((seed * 31) % 120) - 60,
          delay: (seed % 9) * 0.04,
        });
      }
    }
    return list;
  }, [rows, cols]);

  // SSR + reduced-motion fallback: render the assembled image with no per-tile motion.
  // After mount we swap to the shatter animation, so server/client HTML always agree.
  if (!mounted || reduceMotion) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`relative overflow-hidden rounded-lg ${className}`}
        style={{
          backgroundImage: `url('${src}')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`relative overflow-hidden rounded-lg ${className}`}
      style={{ perspective: 1200 }}
    >
      <div
        className="grid h-full w-full"
        style={{
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {tiles.map((tile) => {
          const xPct = cols > 1 ? (tile.col / (cols - 1)) * 100 : 50;
          const yPct = rows > 1 ? (tile.row / (rows - 1)) * 100 : 50;

          return (
            <motion.div
              key={`${tile.row}-${tile.col}`}
              initial={{
                x: tile.dx,
                y: tile.dy,
                rotate: tile.rotate,
                opacity: 0,
                scale: 0.6,
              }}
              whileInView={{ x: 0, y: 0, rotate: 0, opacity: 1, scale: 1 }}
              viewport={{ once: !reverseOnExit, margin: "-60px" }}
              transition={{
                duration: 0.95,
                ease: [0.22, 1, 0.36, 1],
                delay: tile.delay,
              }}
              className="will-change-transform"
              style={{
                backgroundImage: `url('${src}')`,
                backgroundSize: `${cols * 100}% ${rows * 100}%`,
                backgroundPosition: `${xPct}% ${yPct}%`,
                backgroundRepeat: "no-repeat",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
