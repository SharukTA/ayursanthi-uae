import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Split a product's comma-separated `keyIngredients` into display tokens.
// Stored as one string (simple to edit, and it feeds the full-text vector as a
// whole), rendered as individual pills. Newlines count as separators too, so an
// admin who pastes a list off a label gets the same result.
export function splitIngredients(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
