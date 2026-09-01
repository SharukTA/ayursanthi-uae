"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Gift } from "lucide-react";

/**
 * The little draggable gift bubble that floats over the homepage and links to
 * /gifts. Rendered for signed-in and signed-out visitors alike — the homepage is
 * one ISR-cached page for both, and this says the same thing to everyone.
 *
 * Three problems shaped it:
 *
 * 1. "It must not affect the visibility of other content." Hence a 44px circle
 *    (the smallest square that is still a legal touch target) carrying only an
 *    icon, and hence the drag: if it ever does land on something the visitor
 *    wants to read, they move it instead of losing the content.
 *
 * 2. Saying what it is. On a laptop that is a hover tooltip and there is nothing
 *    to solve. A phone has no hover, so the phone gets the words permanently
 *    instead: a two-line micro-caption sits under the circle at all times, and
 *    nobody has to touch the thing to find out what it does. Tapping is
 *    therefore always a navigation, never a "reveal" — no two-tap tax. The
 *    caption is `sm:hidden` and the tooltip is `hidden sm:block`, so exactly one
 *    of them exists at any width. (`aria-label` carries the same text on both,
 *    so a screen reader never depends on either.)
 *
 * 3. Tap vs drag on one element. A press only becomes a drag after
 *    DRAG_THRESHOLD px of travel; below that it stays a click and the link
 *    navigates. A press that did move suppresses the click that follows it, so
 *    dropping the bubble never fires the link.
 *
 * The drag itself deliberately does NOT run through React state. A `setPos` per
 * pointermove is a full render per frame of a finger movement, which is exactly
 * the work that makes a dragged element feel like it is lagging behind the
 * touch. Instead each move parks the latest coordinates on a ref and a single
 * rAF writes one `translate3d` to the node — a compositor-only change, no
 * layout, no React — and the position is committed to state once, on release.
 * See scheduleFrame()/endDrag().
 *
 * Colours are inline styles rather than utility classes on purpose: globals.css
 * rewrites `bg-*` and `text-white` on buttons and links with `!important` to
 * enforce the Amazon CTA look, and this bubble is not a CTA button.
 */

// Versioned. The bubble used to rest in the bottom-right corner, and a returning
// visitor has that corner saved against the old key — restoring it would put
// them back where the button no longer lives and hide the new resting place from
// exactly the people who have seen the site before. Bumping the suffix retires
// those saved positions; anyone who drags it again is saved under v2.
const STORAGE_KEY = "ayursanthi:gift-fab-position:v2";

// Distance kept between the bubble and the edge of the viewport, and the inset
// of its default resting position.
const EDGE_GAP = 16;

// How far a pointer must travel before the press counts as a drag rather than a
// tap. 6px is more than a finger wobbles on a deliberate tap and far less than
// anyone moves when they mean to drag.
const DRAG_THRESHOLD = 6;

// How long the desktop tooltip stays out on its own when the page loads, and
// again (briefly) after the bubble is dropped somewhere new.
const PEEK_MS = 4000;
const PEEK_AFTER_DRAG_MS = 2000;

// Fallback footprint for the clamp maths on the very first restore, before the
// element has been laid out and can report its real size.
const FALLBACK_SIZE = 44;

/** Keeps (x, y) inside the viewport with EDGE_GAP to spare on every side. */
function clampToViewport(x, y, node) {
  const w = node?.offsetWidth || FALLBACK_SIZE;
  const h = node?.offsetHeight || FALLBACK_SIZE;
  // Math.max guards the degenerate case of a viewport narrower than the bubble
  // plus its gaps, where the upper bound would fall below EDGE_GAP and invert
  // the clamp.
  const maxX = Math.max(EDGE_GAP, window.innerWidth - w - EDGE_GAP);
  const maxY = Math.max(EDGE_GAP, window.innerHeight - h - EDGE_GAP);
  return {
    x: Math.min(Math.max(x, EDGE_GAP), maxX),
    y: Math.min(Math.max(y, EDGE_GAP), maxY),
  };
}

export function GiftFloatingButton({ href = "/gifts", label = "Gift Giveaways" }) {
  const nodeRef = useRef(null);
  // Live drag bookkeeping. A ref, not state: it changes on every pointermove and
  // none of it needs to paint.
  const dragRef = useRef(null);
  const frameRef = useRef(0);
  const peekTimer = useRef(null);
  // Set when a press turned into a drag, so the click the browser fires
  // afterwards can be swallowed instead of navigating.
  const suppressClick = useRef(false);

  // null = "has not been moved", which renders against the right edge, centred
  // vertically, in CSS. Once dragged it becomes {x, y} in viewport pixels.
  // Keeping null distinct from a measured position is what lets the default be
  // expressed in CSS — correct on the server, and correct on the first paint at
  // any viewport height — instead of needing a layout pass to compute.
  const [pos, setPos] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [peeking, setPeeking] = useState(true);
  // Which way the tooltip opens. It follows the half of the screen the bubble
  // sits in, so the pill always grows towards the middle and never off-screen.
  const [openLeft, setOpenLeft] = useState(true);

  const peek = useCallback((ms) => {
    clearTimeout(peekTimer.current);
    setPeeking(true);
    peekTimer.current = setTimeout(() => setPeeking(false), ms);
  }, []);

  // Commits a position to React: clamps it, decides which side the tooltip opens
  // on, and optionally persists it. Called on mount and on drop — never during a
  // drag, which is the whole point (see scheduleFrame).
  const commitPos = useCallback((x, y, { persist = false } = {}) => {
    const node = nodeRef.current;
    const next = clampToViewport(x, y, node);
    const width = node?.offsetWidth || FALLBACK_SIZE;
    setPos(next);
    setOpenLeft(next.x + width / 2 > window.innerWidth / 2);
    if (persist) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private mode / storage disabled: the bubble just goes back to its
        // default resting place on the next visit.
      }
    }
    return next;
  }, []);

  // Restore where the visitor last left it, and start the opening peek.
  useEffect(() => {
    let stored = null;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && Number.isFinite(parsed.x) && Number.isFinite(parsed.y)) stored = parsed;
    } catch {
      stored = null;
    }
    // Re-clamped rather than trusted: the position was saved against whatever
    // viewport it was dragged in, and a phone rotated to portrait — or a resized
    // desktop window — would otherwise restore it off-screen.
    if (stored) commitPos(stored.x, stored.y);

    // The tooltip is already out — `peeking` starts true, so the server and the
    // first paint both render it expanded — and mounting only has to schedule
    // its retreat. Parked on the same ref the drag-end peek uses, so the two
    // can't leave competing timers running.
    peekTimer.current = setTimeout(() => setPeeking(false), PEEK_MS);
    return () => clearTimeout(peekTimer.current);
  }, [commitPos]);

  // Same reasoning for a resize mid-session. No-ops while the bubble is still in
  // its CSS-anchored default position, which re-centres itself and needs no
  // help staying put.
  useEffect(() => {
    const onResize = () => {
      const node = nodeRef.current;
      setPos((p) => (p ? clampToViewport(p.x, p.y, node) : p));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Unmounting mid-drag would otherwise leave a pending frame and a page nobody
  // can select text on.
  useEffect(
    () => () => {
      cancelAnimationFrame(frameRef.current);
      document.body.style.removeProperty("user-select");
    },
    [],
  );

  // One transform write per animation frame, however many pointermove events
  // arrived in between. Offsetting from the position the element had when the
  // drag started means this never touches left/top, so the browser can move it
  // on the compositor without a layout pass.
  function scheduleFrame() {
    if (frameRef.current) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = 0;
      const drag = dragRef.current;
      const node = nodeRef.current;
      if (!drag || !node) return;
      node.style.transform = `translate3d(${drag.x - drag.baseX}px, ${drag.y - drag.baseY}px, 0)`;
    });
  }

  function onPointerDown(e) {
    // Right/middle click belongs to the browser (context menu, open in new tab).
    if (e.button !== 0) return;
    const node = nodeRef.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    suppressClick.current = false;
    dragRef.current = {
      pointerId: e.pointerId,
      // Grab offset, so the bubble doesn't snap its corner to the finger.
      dx: e.clientX - rect.left,
      dy: e.clientY - rect.top,
      // Where the element sits in layout right now. Every translate3d during
      // this drag is measured from here.
      baseX: rect.left,
      baseY: rect.top,
      startX: e.clientX,
      startY: e.clientY,
      x: rect.left,
      y: rect.top,
      moved: false,
    };
    // Deliberately NOT capturing the pointer here. See onPointerMove.
  }

  function onPointerMove(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    if (!drag.moved) {
      const travelled = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (travelled < DRAG_THRESHOLD) return; // still a tap
      drag.moved = true;

      // Capture is taken HERE, at the moment the press becomes a drag, and not
      // on pointerdown where it belongs by instinct.
      //
      // This is what was breaking the link on a laptop. While an element holds
      // pointer capture, the browser dispatches the following `click` to the
      // CAPTURING element rather than to whatever was actually under the
      // cursor — so a plain mouse click landed on this wrapper div instead of
      // on the <Link> inside it, the anchor never saw a click, and nothing
      // navigated. A tap on a phone still worked, which is what made it look
      // like a desktop-only bug rather than a capture problem.
      //
      // Deferring it costs nothing: a press that never travels 6px does not
      // need capture at all, and one that does gets it before the pointer has
      // had a chance to leave the 44px circle — which is the case capture
      // exists for, keeping the drag alive when the finger outruns the element.
      nodeRef.current?.setPointerCapture(e.pointerId);

      // The only render a drag causes: it lifts the bubble and hides the
      // tooltip. Everything after this is transform writes.
      setDragging(true);
      // A mouse drag across the page would otherwise select the text underneath.
      document.body.style.setProperty("user-select", "none");
    }
    const next = clampToViewport(e.clientX - drag.dx, e.clientY - drag.dy, nodeRef.current);
    drag.x = next.x;
    drag.y = next.y;
    scheduleFrame();
  }

  function endDrag(e) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    cancelAnimationFrame(frameRef.current);
    frameRef.current = 0;
    // Guarded rather than blindly released: capture is only taken once a press
    // becomes a drag, so on every ordinary tap there is nothing to release and
    // an unguarded call would throw NotFoundError.
    try {
      const node = nodeRef.current;
      if (node?.hasPointerCapture?.(e.pointerId)) node.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer already gone (cancelled); nothing to release.
    }
    if (!drag.moved) return; // a plain tap: let the link do its job

    suppressClick.current = true;
    document.body.style.removeProperty("user-select");

    const node = nodeRef.current;
    if (node) {
      // Hand the drag over from transform to left/top in one synchronous write,
      // before React re-renders. Doing it here rather than waiting for the
      // render means there is never a frame where the transform is gone but the
      // new offsets have not landed — i.e. no snap back to where it was.
      // Every property of the CSS-anchored default is cleared explicitly,
      // because the very first drag starts from it and they are all still set:
      // the right inset, and the full-height/auto-margin pair that centres it.
      // Leaving the margins behind would fight the new `top` and drop the bubble
      // back into the middle of the screen.
      node.style.transform = "";
      node.style.right = "";
      node.style.bottom = "";
      node.style.marginTop = "";
      node.style.marginBottom = "";
      node.style.height = "";
      node.style.left = `${drag.x}px`;
      node.style.top = `${drag.y}px`;
    }
    setDragging(false);
    commitPos(drag.x, drag.y, { persist: true });
    // Re-announce after the move, on the viewports that have a tooltip to
    // announce with.
    peek(PEEK_AFTER_DRAG_MS);
  }

  function onClick(e) {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    e.preventDefault();
  }

  // The tooltip is out whenever the bubble is pointed at, focused by keyboard,
  // or peeking of its own accord — but never mid-drag, where a pill trailing the
  // cursor only gets in the way.
  const expanded = !dragging && (hovered || focused || peeking);

  return (
    <div
      ref={nodeRef}
      // `fixed` so it rides the viewport rather than the page. z-40 keeps it over
      // page content but under the sticky header (z-50) and any dialog, so it can
      // never cover the nav or block a modal.
      className="fixed z-40 flex flex-col items-center print:hidden"
      style={{
        ...(pos
          ? { left: `${pos.x}px`, top: `${pos.y}px` }
          : {
              right: `${EDGE_GAP}px`,
              // Vertically centred on the right edge, on every viewport.
              //
              // Done with auto margins against a full-height inset rather than
              // `top: 50%` + `translateY(-50%)`, because the drag OWNS the
              // transform: its first frame overwrites whatever is there, and a
              // -50% shift silently baked into the starting position would make
              // the bubble jump half its own height the instant it was picked
              // up. Auto margins centre it with no transform at all, so there is
              // nothing for the drag to clobber.
              top: 0,
              bottom: 0,
              marginTop: "auto",
              marginBottom: "auto",
              height: "fit-content",
            }),
        // Without this the browser claims the gesture for page scrolling and no
        // pointermove ever arrives, so the bubble would only drag with a mouse.
        touchAction: "none",
        cursor: dragging ? "grabbing" : "grab",
        // Promotes the element to its own layer for the duration of the drag, so
        // each frame is a composite rather than a repaint. Only while dragging —
        // a permanent `will-change` keeps that layer alive for the whole session.
        willChange: dragging ? "transform" : "auto",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={href}
        aria-label={label}
        // The browser's own image-drag on a link would fight the pointer drag.
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onClick={onClick}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full outline-none transition-transform duration-200 hover:scale-105 focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 active:scale-95 sm:h-12 sm:w-12"
        style={{
          backgroundImage: "linear-gradient(140deg, #fbbf24, #f59e0b)",
          color: "#0f1111",
          border: "1px solid #f59e0b",
          WebkitTapHighlightColor: "transparent",
          // Lifts off the page while held, which is the feedback that says "you
          // have picked this up" rather than "you have tapped this". Inline, so
          // it beats the hover/active scale utilities above for the duration.
          ...(dragging
            ? {
                transform: "scale(1.08)",
                boxShadow: "0 12px 28px rgba(15, 17, 17, 0.35)",
              }
            : { boxShadow: "0 6px 20px rgba(15, 17, 17, 0.28)" }),
        }}
      >
        {/* Halo. Runs only while the tooltip is out, so the homepage isn't
            hosting a permanently pulsing dot; motion-safe drops it for reduced
            motion. */}
        {expanded ? (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping"
            style={{ backgroundColor: "#fbbf24" }}
          />
        ) : null}
        <Gift aria-hidden="true" className="relative h-5 w-5 sm:h-5.5 sm:w-5.5" />
      </Link>

      {/* PHONES: the words, permanently, under the icon. In normal flow rather
          than absolutely positioned, so the wrapper's measured height includes it
          and clampToViewport keeps the caption on screen too — pinned below the
          circle it would hang off the bottom edge once dragged there. The
          max-width is what breaks it onto two tidy lines ("Gift" / "Giveaways")
          instead of one wide strip. aria-hidden: the link's aria-label already
          says this. */}
      <span
        aria-hidden="true"
        className="pointer-events-none mt-1 max-w-17 rounded-full px-1.5 py-0.5 text-center text-[10px] leading-tight font-semibold sm:hidden"
        style={{
          backgroundColor: "#0f1111",
          color: "#ffffff",
          boxShadow: "0 3px 10px rgba(15, 17, 17, 0.28)",
        }}
      >
        {label}
      </span>

      {/* LAPTOPS: the same words as a hover/focus tooltip. Absolutely positioned
          and pointer-events-none so it neither resizes the draggable element (the
          clamp measures that) nor swallows a click meant for the circle. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 hidden rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-200 sm:block"
        style={{
          ...(openLeft ? { right: "calc(100% + 10px)" } : { left: "calc(100% + 10px)" }),
          backgroundColor: "#0f1111",
          color: "#ffffff",
          boxShadow: "0 4px 14px rgba(15, 17, 17, 0.3)",
          opacity: expanded ? 1 : 0,
          // Slides out from behind the bubble rather than appearing in place.
          transform: `translateY(-50%) translateX(${expanded ? "0" : openLeft ? "8px" : "-8px"})`,
        }}
      >
        {label}
      </span>
    </div>
  );
}
