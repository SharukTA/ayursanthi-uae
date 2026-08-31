"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Lightweight, presentational modal that mirrors the portal/backdrop/scroll-lock
 * behaviour of ConfirmDialog but takes arbitrary children (e.g. a form). Render
 * it conditionally:
 *
 *   {open ? (
 *     <Modal title="Add Item" onClose={() => setOpen(false)}>
 *       ...content...
 *     </Modal>
 *   ) : null}
 *
 * `onClose` fires on backdrop click, the close button, and the Escape key.
 *
 * `widthClass` / `bodyClassName` let a caller widen the card or take over its
 * padding (the product "full details" reader needs both); the defaults are the
 * narrow form every other caller already relies on.
 */
export function Modal({
  title,
  onClose,
  children,
  widthClass = "max-w-xs sm:max-w-lg",
  bodyClassName = "p-4 sm:p-5",
}) {
  // Lock body scroll and wire up Escape while the modal is open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div
      // Body scroll-lock alone doesn't hold here: Lenis (LenisProvider) drives
      // smooth scrolling off window-level wheel events, so it keeps scrolling the
      // page behind the modal regardless of `overflow: hidden`. `data-lenis-prevent`
      // makes Lenis ignore any wheel event originating inside the overlay, handing
      // it back to native scrolling on the card body below.
      data-lenis-prevent
      className="fixed inset-0 z-100 flex items-center justify-center overflow-y-auto p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Card — narrower on phones, roomier from sm up. */}
      <div
        className={`relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-150 sm:max-h-[90vh] ${widthClass}`}
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-400 transition hover:text-slate-700"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className={`min-w-0 overflow-y-auto ${bodyClassName}`}>{children}</div>
      </div>
    </div>,
    document.body
  );
}
