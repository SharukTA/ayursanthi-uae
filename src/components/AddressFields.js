"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { COUNTRIES, flagEmoji, getCountry } from "@/lib/geo/countries";
import { getStates } from "@/lib/geo/states";

// Address building blocks shared by checkout (and reusable elsewhere):
//   <CountrySelect> — searchable country dropdown (flag + name), value is ISO2.
//   <StateField>    — a province dropdown when we have data for the country,
//                     otherwise a plain text input. City stays a text field in
//                     the parent, matching the agreed Country → State → City
//                     (text) cascade.

export function CountrySelect({
  value,
  onChange,
  disabled = false,
  error = false,
  buttonClassName = "",
  id,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef(null);
  const selected = getCountry(value);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q
    );
  }, [query]);

  const select = (code) => {
    onChange?.(code);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-[3px] border text-left outline-none disabled:opacity-60 ${
          error ? "border-red-500" : ""
        } ${buttonClassName}`}
      >
        {selected ? (
          <>
            <span className="text-base leading-none">{flagEmoji(selected.code)}</span>
            <span className="min-w-0 flex-1 truncate">{selected.name}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 truncate text-[#565959]">Select a country</span>
        )}
        <ChevronDown className="size-4 shrink-0 text-[#565959]" />
      </button>

      {open && (
        <div
          data-lenis-prevent
          className="absolute left-0 top-full z-50 mt-1 w-full min-w-[16rem] overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <Search className="size-4 shrink-0 text-slate-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search country"
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
                    aria-selected={c.code === value}
                    onClick={() => select(c.code)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-slate-50 ${
                      c.code === value ? "bg-slate-50 font-semibold" : ""
                    }`}
                  >
                    <span className="text-base leading-none">{flagEmoji(c.code)}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-800">{c.name}</span>
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

export function StateField({
  country,
  value,
  onChange,
  disabled = false,
  error = false,
  className = "",
  placeholder = "State / Province",
  id,
}) {
  const states = getStates(country);
  const borderClass = error ? "border-red-500" : "";

  if (states) {
    return (
      <select
        id={id}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        aria-invalid={error ? "true" : undefined}
        className={`${className} ${borderClass}`}
      >
        <option value="">Choose a state</option>
        {states.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
    );
  }

  // No dataset for this country — fall back to free text.
  return (
    <input
      id={id}
      type="text"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={disabled}
      aria-invalid={error ? "true" : undefined}
      placeholder={placeholder}
      className={`${className} ${borderClass}`}
    />
  );
}
