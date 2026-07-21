"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

// ─────────────────────────────────────────────────────────────────────────────
// Collapses long product descriptions to a fixed height with a soft fade and a
// "See more" / "See less" toggle (Amazon-style). The toggle only appears when
// the content is actually taller than the collapsed height — short descriptions
// render in full with no button. A ResizeObserver re-checks as images load so
// the decision stays correct once media finishes loading.
// ─────────────────────────────────────────────────────────────────────────────
export function DescriptionCollapse({ children, collapsedHeight = 460 }) {
  const contentRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const check = () => setOverflows(el.scrollHeight > collapsedHeight + 24);
    check();

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [collapsedHeight]);

  const collapsed = overflows && !expanded;

  return (
    <div>
      <div
        ref={contentRef}
        style={collapsed ? { maxHeight: collapsedHeight } : undefined}
        className="relative overflow-hidden"
      >
        {children}
        {collapsed ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-slate-50 to-transparent" />
        ) : null}
      </div>

      {overflows ? (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-300 hover:bg-emerald-50"
          >
            {expanded ? "See less" : "See more"}
            <ChevronDown
              className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}
