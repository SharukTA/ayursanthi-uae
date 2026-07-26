"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Reusable, promise-based confirmation modal that replaces the native
 * `window.confirm()`. Use the `useConfirm` hook:
 *
 *   const [confirm, confirmDialog] = useConfirm();
 *   ...
 *   if (!(await confirm({ title: "Delete?", description: "..." }))) return;
 *   ...
 *   return (<>{...page...}{confirmDialog}</>);
 *
 * Render `confirmDialog` once anywhere in the page tree. `confirm(options)`
 * resolves to `true` when the user confirms and `false` otherwise.
 */
export function useConfirm() {
  // { options, resolve } while a dialog is open, otherwise null.
  const [request, setRequest] = useState(null);

  const confirm = useCallback(
    (options = {}) =>
      new Promise((resolve) => {
        setRequest({ options, resolve });
      }),
    []
  );

  const close = useCallback(
    (result) => {
      setRequest((current) => {
        current?.resolve(result);
        return null;
      });
    },
    []
  );

  const dialog = request ? (
    <ConfirmDialog
      {...request.options}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null;

  return [confirm, dialog];
}

function ConfirmDialog({
  title = "Are you sure?",
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger", // "danger" | "default"
  onConfirm,
  onCancel,
}) {
  const [busy, setBusy] = useState(false);

  // Lock body scroll and wire up Escape while the dialog is open.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(e) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onCancel]);

  // Allow the confirm action to be async (e.g. await the delete) while the
  // modal stays up and shows a spinner. Callers may return a promise.
  async function handleConfirm() {
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
    }
  }

  const isDanger = tone === "danger";

  return createPortal(
    <div
      // Stop Lenis smooth-scroll (LenisProvider) from scrolling the page behind
      // the dialog — body `overflow: hidden` doesn't cover its window-level wheel
      // handling. See the same note in Modal.js.
      data-lenis-prevent
      className="fixed inset-0 z-100 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
        onClick={() => !busy && onCancel()}
      />

      {/* Card */}
      <div className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl shadow-black/30 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-4">
          <span
            className={`flex size-11 shrink-0 items-center justify-center rounded-full ${
              isDanger
                ? "bg-rose-100 text-rose-600"
                : "bg-teal-100 text-[#0f1111]"
            }`}
          >
            <AlertTriangle className="size-5" />
          </span>
          <div className="flex-1 pt-0.5">
            <h2
              id="confirm-dialog-title"
              className="text-base font-bold text-slate-900"
            >
              {title}
            </h2>
            {description ? (
              <p className="mt-1.5 text-sm leading-6 text-slate-600">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            autoFocus
            type="button"
            variant={isDanger ? "destructive" : "default"}
            size="sm"
            disabled={busy}
            onClick={handleConfirm}
          >
            {busy ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Working...
              </>
            ) : (
              confirmLabel
            )}
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
