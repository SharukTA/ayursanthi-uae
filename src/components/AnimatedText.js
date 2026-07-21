"use client";

import { motion, useReducedMotion } from "motion/react";

const wordVariants = {
  hidden: { opacity: 0, y: 22, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const charVariants = {
  hidden: { opacity: 0, y: 18, rotateX: -45 },
  visible: {
    opacity: 1,
    y: 0,
    rotateX: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * AnimatedHeading — animates words in with blur/slide.
 * Renders as <h1> by default; pass `as` to change tag.
 */
export function AnimatedHeading({
  text,
  as: Tag = "h1",
  className = "",
  delay = 0,
  stagger = 0.08,
  once = true,
  highlightWords = [],
  highlightClassName = "",
}) {
  const reduceMotion = useReducedMotion();
  const words = text.split(" ");

  if (reduceMotion) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={className}>
      <motion.span
        initial="hidden"
        whileInView="visible"
        viewport={{ once, margin: "-60px" }}
        transition={{ staggerChildren: stagger, delayChildren: delay }}
        className="inline-block"
      >
        {words.map((word, i) => {
          const isHighlighted = highlightWords.includes(word.replace(/[.,!?]/g, ""));
          return (
            <motion.span
              key={`${word}-${i}`}
              variants={wordVariants}
              className={`inline-block whitespace-pre ${isHighlighted ? highlightClassName : ""}`}
              style={{ willChange: "transform, opacity, filter" }}
            >
              {word}
              {i < words.length - 1 && " "}
            </motion.span>
          );
        })}
      </motion.span>
    </Tag>
  );
}

/**
 * AnimatedChars — character-by-character flip-in.
 * Best for short text (logo subtitles, button labels, eyebrows).
 */
export function AnimatedChars({
  text,
  as: Tag = "span",
  className = "",
  delay = 0,
  stagger = 0.03,
  once = true,
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <Tag className={className}>{text}</Tag>;
  }

  return (
    <Tag className={`inline-block ${className}`} style={{ perspective: 800 }}>
      <motion.span
        initial="hidden"
        whileInView="visible"
        viewport={{ once, margin: "-40px" }}
        transition={{ staggerChildren: stagger, delayChildren: delay }}
        className="inline-block"
      >
        {Array.from(text).map((ch, i) => (
          <motion.span
            key={i}
            variants={charVariants}
            className="inline-block"
            style={{ transformStyle: "preserve-3d", willChange: "transform, opacity" }}
          >
            {ch === " " ? " " : ch}
          </motion.span>
        ))}
      </motion.span>
    </Tag>
  );
}

/**
 * AnimatedReveal — generic block reveal with slide+fade.
 * Use for paragraphs, CTAs, or any element you want to ease into view.
 */
export function AnimatedReveal({
  children,
  className = "",
  delay = 0,
  y = 24,
  once = true,
}) {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: "-40px" }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
