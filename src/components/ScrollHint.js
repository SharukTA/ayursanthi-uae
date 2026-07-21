"use client";

import { motion, useReducedMotion } from "motion/react";
import { ChevronDown } from "lucide-react";

export function ScrollHint({ label = "Scroll to explore", className = "" }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className={`flex flex-col items-center gap-2 ${className}`}
    >
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0f1111]">
        {label}
      </span>
      <motion.span
        animate={reduceMotion ? undefined : { y: [0, 8, 0] }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="flex size-8 items-center justify-center rounded-full border border-[#d5d9d9] bg-[#f7fafa] text-[#0f1111] backdrop-blur"
      >
        <ChevronDown className="size-4" />
      </motion.span>
    </motion.div>
  );
}
