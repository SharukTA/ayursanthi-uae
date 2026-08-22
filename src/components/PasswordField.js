"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

// A password input with a show/hide eye button pinned inside its right edge.
//
// Deliberately a thin wrapper: the field's own look (height, border, focus
// glow) still comes from the caller's `className`, because the auth pages and
// the checkout use two different form styles. All this adds is the toggle and
// the right-hand padding that keeps typed text from running under it.
//
// The button is `type="button"` so it never submits the form it sits in, and
// `tabIndex={-1}` so tabbing runs straight from the password to the submit
// button — a keyboard user is not made to step over a decorative control.
// `bg-transparent` is insurance, not a fix for a live bug: globals.css restyles
// buttons by background class (bg-emerald-*, bg-white) and would otherwise give
// this one a border and a hover lift the day someone tints it.

export function PasswordField({
  value,
  onChange,
  className = "",
  buttonClassName = "text-[#565959] hover:text-[#0f1111]",
  ...inputProps
}) {
  const [visible, setVisible] = useState(false);
  const Icon = visible ? EyeOff : Eye;

  return (
    <div className="relative min-w-0">
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        className={`${className} pr-11`}
        {...inputProps}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        disabled={inputProps.disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        title={visible ? "Hide password" : "Show password"}
        className={`absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md bg-transparent outline-none disabled:cursor-not-allowed disabled:opacity-60 ${buttonClassName}`}
      >
        <Icon className="size-4.5" aria-hidden="true" />
      </button>
    </div>
  );
}
