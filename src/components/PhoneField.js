"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRIES, flagEmoji, getCountry } from "@/lib/geo/countries";
import { getMaxNationalLength } from "@/lib/geo/phone-rules";

// Amazon-style phone entry: a country dial-code picker on the left and the
// national number on the right. The component owns the country/number split
// internally and emits a single E.164 string ("+<dial><digits>") through
// onChange, so callers keep storing one plain phone value. An empty number
// emits "" so an optional phone stays optional.
//
// The visible border/height/background live on the wrapper via `className` so
// the control blends into whatever form hosts it; `borderClassName` sets the
// idle border colour (overridden to red on `error`). `inputClassName` styles
// the number input's padding/text.

// Longest dial codes first, so "+1268" matches Antigua before "+1" (US/Canada).
const BY_DIAL_DESC = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);

function parseValue(value, fallbackCode) {
  const raw = String(value || "").trim();
  if (!raw) return { code: fallbackCode, national: "" };
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) {
    const match = BY_DIAL_DESC.find((c) => digits.startsWith(c.dial));
    if (match) return { code: match.code, national: digits.slice(match.dial.length) };
  }
  // No "+" or no known code — treat the digits as a national number under the
  // fallback country rather than losing what the user typed.
  return { code: fallbackCode, national: digits };
}

export function PhoneField({
  value,
  onChange,
  defaultCountry = "AE",
  disabled = false,
  required = false,
  error = false,
  id,
  name,
  placeholder = "Phone number",
  autoComplete = "tel",
  className = "",
  inputClassName = "",
  borderClassName = "border-slate-300",
}) {
  const initial = parseValue(value, defaultCountry);
  const [code, setCode] = useState(initial.code);
  const [national, setNational] = useState(initial.national);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);

  const country = getCountry(code) || getCountry(defaultCountry);
  const dial = country?.dial || "";
  const composed = national ? `+${dial}${national}` : "";
  // Hard stop on how many digits the selected country can accept, so an over-
  // long number is impossible to type rather than only rejected on submit.
  const maxNational = getMaxNationalLength(country?.code || defaultCountry);

  // Keep internal state in sync when the parent value changes from the outside
  // (e.g. a profile that loads asynchronously). Guarded against our own emits.
  useEffect(() => {
    if ((value || "") !== composed) {
      const parsed = parseValue(value, defaultCountry);
      setCode(parsed.code);
      setNational(parsed.national);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close the dropdown on an outside click or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const emit = (nextCode, nextNational) => {
    const d = getCountry(nextCode)?.dial || "";
    onChange?.(nextNational ? `+${d}${nextNational}` : "");
  };

  const handleNational = (raw) => {
    const clean = raw.replace(/\D/g, "").slice(0, maxNational);
    setNational(clean);
    emit(code, clean);
  };

  const selectCountry = (nextCode) => {
    // Switching to a country with a shorter plan (e.g. India -> Qatar) would
    // otherwise leave digits behind that the new country can never accept.
    const trimmed = national.slice(0, getMaxNationalLength(nextCode));
    setCode(nextCode);
    setNational(trimmed);
    setOpen(false);
    setQuery("");
    emit(nextCode, trimmed);
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(q.replace(/\D/g, "")) ||
        c.code.toLowerCase() === q
    );
  }, [query]);

  const edgeBorder = error ? "border-red-500" : borderClassName;

  return (
    <div
      ref={rootRef}
      className={`relative flex min-w-0 items-stretch rounded-md border ${edgeBorder} ${className}`}
    >
      {/* Country dial-code button */}
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country code: ${country?.name || ""} +${dial}`}
        className={`flex shrink-0 items-center gap-1 border-r pl-2 pr-1.5 outline-none disabled:opacity-60 ${edgeBorder}`}
      >
        <span className="text-base leading-none">{flagEmoji(code)}</span>
        <span className="tabular-nums text-[13px] text-slate-600">+{dial}</span>
        <ChevronDown className="size-3.5 text-slate-500" />
      </button>

      {/* National number */}
      <input
        id={id}
        name={name}
        type="tel"
        inputMode="tel"
        autoComplete={autoComplete}
        value={national}
        onChange={(e) => handleNational(e.target.value)}
        disabled={disabled}
        required={required}
        maxLength={maxNational}
        placeholder={placeholder}
        aria-invalid={error ? "true" : undefined}
        className={`min-w-0 flex-1 bg-transparent outline-none disabled:opacity-60 ${inputClassName}`}
      />

      {/* Country dropdown */}
      {open && (
        <div
          data-lenis-prevent
          className="absolute left-0 top-full z-50 mt-1 w-72 max-w-[85vw] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country or code"
              className="w-full bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <ul role="listbox" className="max-h-64 overflow-y-auto overscroll-contain py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">No matches</li>
            ) : (
              filtered.map((c) => (
                <li key={c.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={c.code === code}
                    onClick={() => selectCountry(c.code)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      c.code === code ? "bg-slate-50 font-semibold" : ""
                    }`}
                  >
                    <span className="text-base leading-none">{flagEmoji(c.code)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800">{c.name}</span>
                    <span className="tabular-nums text-xs text-slate-500">+{c.dial}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
