"use client";

import { useEffect, useRef, useState } from "react";
import { Gift, Trophy, Users } from "lucide-react";
import {
  firstNameOf,
  formatDrawDate,
  GIFT_FULFILMENT_LABELS,
  referredWinnerName,
  shouldCelebrateWin,
} from "@/lib/gift-shared";
import { useSession } from "@/components/SessionProvider";

// The "you won" moment, shown to a winner on their own gifts screen and on the
// public /gifts page.
//
// A win is the one event in the whole programme the customer did nothing to
// trigger and cannot see coming, so it has to announce itself. The email does
// that job in their inbox; this does it on the site, for the winner who clicks
// through from that email — or who happens to be browsing when the draw is
// published — and it deliberately looks nothing like the rest of the page.
//
// Two exports, because the two pages know different things:
//   - GiftWinCelebration takes the wins it should celebrate. /dashboard/gifts
//     already has them from /api/user/gifts, so it must not fetch them again.
//   - GiftWinBanner fetches for itself, for /gifts — a statically revalidated
//     marketing page that cannot know who is reading it. It renders nothing at
//     all for signed-out visitors and for customers who have not won.
//
// It is a temporary announcement, not a permanent record. Both entry points run
// their wins through shouldCelebrateWin, so the banner retires itself two days
// after the admin runs the draw — or the moment the admin marks the prize
// delivered, whichever comes first. A giveaway page still congratulating
// somebody a month later reads as an abandoned site, and one still promising a
// call about a prize already handed over reads as worse than that. The prizes
// themselves go on being listed on /dashboard/gifts for good, which is where a
// customer looks for something they own.

const CONFETTI_COLORS = ["#fbbf24", "#f59e0b", "#10b981", "#0ea5e9", "#ec4899", "#8b5cf6"];
const CONFETTI_EMOJI = ["🎉", "🎊", "✨", "🏆", "🎁", "⭐"];

// How many bursts a run fires, and how far apart. Shared with the animation loop
// so its "have all the bursts gone off yet?" check cannot drift from the timers
// that actually schedule them.
const BURST_COUNT = 5;
const BURST_GAP_MS = 320;

// Which wins this browser has already celebrated. Kept per win id rather than as
// a single flag so a customer who wins a second prize gets the fireworks again
// for that one, while the first win does not re-fire every time they open the
// page — a celebration that never stops stops being a celebration.
const SEEN_KEY = "ays-gift-wins-celebrated";

function readSeen() {
  // Any of these can throw or return junk: private windows, cleared storage, a
  // half-written value from an older build. A celebration is decoration, so
  // every failure degrades to "nothing seen yet" rather than breaking the page.
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : [];
  } catch {
    return [];
  }
}

// Win ids this PAGE LOAD has already auto-fired for, which is a different
// question from what the browser has celebrated in the past.
//
// It exists for StrictMode. In development React mounts every effect, tears it
// down, and mounts it again — so without this the first mount would write the
// ids into localStorage and the second would find nothing unseen and play
// nothing at all, making the fireworks impossible to see on the very builds
// they are being worked on. A module-level set is emptied by a full page load,
// which is exactly the boundary "celebrate once per win" should be measured at.
const autoFiredThisLoad = new Set();

function markSeen(ids) {
  try {
    const merged = [...new Set([...readSeen(), ...ids])];
    // Trimmed from the front: a customer with a hundred wins is not a case worth
    // holding unbounded storage for, and the oldest ids are the ones nobody is
    // going to be shown fireworks for again anyway.
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(merged.slice(-50)));
  } catch {
    // Storage unavailable. The only consequence is that the burst plays again on
    // the next visit, which is the harmless direction to fail in.
  }
}

/**
 * Full-screen fireworks, drawn on a canvas that sits over the page.
 *
 * Hand-rolled rather than pulled from a package: the whole effect is one
 * requestAnimationFrame loop over an array of particles, and a dependency for
 * that would cost more bytes on every page importing this component than the
 * code it replaces.
 *
 * Bursts rather than a curtain of falling confetti — a firework reads as
 * "something happened just now", which is the feeling a win wants, where a
 * steady fall reads as background decoration. Each burst throws particles out
 * radially from a point in the upper half of the screen, then gravity takes them
 * down.
 *
 * `pointer-events-none` throughout, and the canvas is left at zero size whenever
 * nothing is playing, so an idle celebration holds no backing store and cannot
 * sit invisibly on top of the page swallowing clicks.
 *
 * The decision to play lives HERE rather than in the parent, and that is the
 * whole reason this component owns `winIds`. Whether to fire is a question about
 * browser storage and the reduced-motion setting — both browser-only — so
 * answering it in the parent would mean setting React state from inside an
 * effect on every mount. Deciding it in the effect that already runs the canvas
 * keeps the whole thing one synchronisation with an external system, which is
 * what it actually is.
 *
 * @param {object} props
 * @param {string} props.winIds  comma-joined win ids, fired for once each per
 *   browser
 */
function Fireworks({ winIds }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const unseen = winIds.split(",").filter((id) => id && !readSeen().includes(id));

    if (unseen.length > 0) {
      // Marked before the motion check below, so a customer who does not see the
      // fireworks is not asked about them again either.
      markSeen(unseen);
      autoFiredThisLoad.add(winIds);
    } else if (!autoFiredThisLoad.has(winIds)) {
      // Celebrated on an earlier visit. The banner stays for the rest of its
      // window; the fireworks are a one-off.
      return undefined;
    }

    // A customer who has asked their system to stop animations gets the banner
    // and no canvas at all. The news is in the text, and this is exactly the
    // kind of purely decorative motion that setting exists to suppress.
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;

    const context = canvas.getContext("2d");
    if (!context) return undefined;

    // Backing store scaled to the device pixel ratio, or the particles are a
    // blurry mess on every phone and retina laptop. Capped at 2 because the
    // third multiple of resolution costs fill rate and buys nothing visible.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let width = window.innerWidth;
    let height = window.innerHeight;

    function size() {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    window.addEventListener("resize", size);

    const particles = [];

    function burst(x, y) {
      const count = 34 + Math.floor(Math.random() * 14);
      for (let i = 0; i < count; i += 1) {
        // Angles spread evenly around the circle with a jitter, so a burst looks
        // like an explosion rather than a clock face. Speed varies per particle
        // to give the ring some depth as it expands.
        const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
        const speed = 2.6 + Math.random() * 4.4;
        // One in five is an emoji rather than a paper square. Enough to read as
        // "party" up close; more than that and the burst loses its shape,
        // because a glyph covers many times the area of a 7px rectangle.
        const isEmoji = Math.random() < 0.2;
        particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.008 + Math.random() * 0.011,
          size: isEmoji ? 14 + Math.random() * 12 : 5 + Math.random() * 5,
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.28,
          color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
          emoji: isEmoji ? CONFETTI_EMOJI[Math.floor(Math.random() * CONFETTI_EMOJI.length)] : null,
        });
      }
    }

    // Bursts staggered across the width so the eye is pulled around the screen
    // instead of watching one spot. The first fires immediately: a celebration
    // that starts half a second after the page settles has missed the moment.
    const timers = [];
    for (let i = 0; i < BURST_COUNT; i += 1) {
      timers.push(
        window.setTimeout(() => {
          burst(width * (0.18 + Math.random() * 0.64), height * (0.16 + Math.random() * 0.34));
        }, i * BURST_GAP_MS)
      );
    }

    const start = performance.now();
    let frame = 0;

    function tick() {
      context.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.11; // gravity
        p.vx *= 0.985; // air resistance, so the ring slows as it widens
        p.vy *= 0.985;
        p.rotation += p.spin;
        p.life -= p.decay;

        if (p.life <= 0 || p.y > height + 60) {
          particles.splice(i, 1);
          continue;
        }

        context.save();
        context.globalAlpha = Math.max(0, Math.min(1, p.life));
        context.translate(p.x, p.y);
        context.rotate(p.rotation);
        if (p.emoji) {
          context.font = `${p.size}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
          context.textAlign = "center";
          context.textBaseline = "middle";
          context.fillText(p.emoji, 0, 0);
        } else {
          context.fillStyle = p.color;
          // Half height, so a spinning rectangle reads as a tumbling piece of
          // paper rather than a square block.
          context.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        context.restore();
      }

      // Ends only once the last burst has fired AND everything from it has
      // fallen. Checking for an empty array alone would stop the run in the gap
      // between two bursts, before most of the fireworks had happened.
      const stillFiring = performance.now() - start < BURST_COUNT * BURST_GAP_MS;
      if (particles.length === 0 && !stillFiring) {
        // Nothing left to draw. Dropping the backing store to nothing is what
        // keeps an idle page from carrying a full-viewport canvas around in
        // memory for the rest of the session.
        canvas.width = 0;
        canvas.height = 0;
        return;
      }
      frame = window.requestAnimationFrame(tick);
    }

    frame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("resize", size);
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [winIds]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-60"
      // No backing store until a run starts, and it is dropped again when one
      // ends: an idle celebration costs nothing, where a full-viewport canvas
      // held open for the session would carry megabytes of pixels for no reason.
      // The element itself stays in the layer, transparent and — through
      // pointer-events-none — unable to intercept a single click.
      width={0}
      height={0}
    />
  );
}

/** The cover photograph of a won prize, or a placeholder that holds the space. */
function PrizeThumb({ win }) {
  const url = win.prize?.images?.[0]?.url;

  if (!url) {
    return (
      <span
        className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-400 sm:size-20"
        aria-hidden="true"
      >
        <Gift className="size-7" />
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={win.prize.name}
      loading="lazy"
      className="size-16 shrink-0 rounded-lg border border-amber-200 object-cover sm:size-20"
    />
  );
}

/** The referred customer's first name, or null when it was not sent. */
function referredFirstName(win) {
  return firstNameOf(referredWinnerName(win));
}

/**
 * The line under "Congratulations — you won!".
 *
 * Branches on the KIND of win, because the old single sentence — "your gift
 * coupon was drawn" — is not merely bland for a referrer, it is untrue: they
 * hold no coupon and none of theirs was drawn. They are owed the prize because
 * somebody they introduced to the store won one.
 *
 * Naming that person is the point of the referrer wording. The winner email
 * names them, so a page that says only "someone you referred" reads as the
 * store knowing less than its own mail — and a referrer with several
 * referrals genuinely cannot tell which of them this is about. The name is
 * dropped only when the caller did not send the relation, which is the one
 * case where the vaguer sentence is the honest one.
 *
 * A customer can hold both kinds at once, from the same draw or from two, and
 * that mixture gets its own sentence rather than one of the two specific ones
 * — being told only about the referral when a coupon of your own also won
 * would be the more disappointing half of the truth.
 */
function celebrationSubtitle(announced) {
  const referrerWins = announced.filter((win) => win.kind === "REFERRER");
  const count = announced.length;

  if (referrerWins.length === 0) {
    return count > 1
      ? `Your coupons were drawn for ${count} prizes in the gift draw.`
      : "Your gift coupon was drawn in the gift draw.";
  }

  if (referrerWins.length === count) {
    // De-duplicated: one referred customer can win more than one prize in a
    // draw, and naming them twice in the same sentence reads as two people.
    const names = [...new Set(referrerWins.map(referredFirstName).filter(Boolean))];

    if (names.length === 1) {
      return count > 1
        ? `${names[0]}, who you referred, won ${count} prizes — and you receive the same.`
        : `${names[0]}, who you referred, won the gift draw — so the same prize is yours.`;
    }
    if (names.length > 1) {
      return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}, who you referred, won the gift draw — and you receive the same prizes.`;
    }
    return count > 1
      ? `Customers you referred won ${count} prizes — and you receive the same.`
      : "Someone you referred won the gift draw — so the same prize is yours.";
  }

  return `Your coupon was drawn, and someone you referred won too — ${count} prizes are yours.`;
}

/**
 * The banner itself.
 *
 * Filters the wins it is given down to the ones still worth announcing — recent
 * and not yet delivered — and renders nothing at all when none are left. Doing
 * it here rather than at each call site is what stops the two pages drifting
 * apart on when a win stops being news.
 *
 * @param {object} props
 * @param {Array} props.wins  published wins belonging to the signed-in customer
 */
export function GiftWinCelebration({ wins }) {
  const announced = (wins ?? []).filter((win) => shouldCelebrateWin(win));

  // Joined into a string so Fireworks depends on WHICH wins these are rather
  // than on the array's identity, which is new on every fetch.
  const ids = announced.map((win) => win.id).join(",");

  if (announced.length === 0) return null;

  const multiple = announced.length > 1;

  return (
    <>
      <Fireworks winIds={ids} />

      <section
        // Announced politely rather than assertively: it is good news, not an
        // error, so a screen reader should finish the sentence it is on first.
        aria-live="polite"
        className="overflow-hidden rounded-xl border-2 border-amber-300 bg-amber-50/60 shadow-sm"
      >
        <div className="border-b border-amber-200 bg-amber-100/70 px-4 py-3 text-center sm:px-6 sm:py-4">
          <p className="text-2xl leading-none sm:text-3xl" aria-hidden="true">
            🎉 🎊 🎉
          </p>
          <h2 className="mt-1.5 text-lg font-black text-amber-900 sm:text-2xl">
            Congratulations — you won!
          </h2>
          <p className="mt-1 text-[11px] font-semibold text-amber-800 sm:text-xs">
            {celebrationSubtitle(announced)}
          </p>
        </div>

        <div className="grid gap-2.5 px-4 py-4 sm:px-6">
          {announced.map((win) => (
            <div
              key={win.id}
              className="flex items-center gap-3 rounded-lg border border-amber-200 bg-white p-3"
            >
              <PrizeThumb win={win} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900 sm:text-base">
                  <Trophy className="size-4 shrink-0 text-amber-500" />
                  <span className="truncate">{win.prize.name}</span>
                </p>
                {win.prize.valueNote ? (
                  <p className="mt-0.5 text-[11px] font-black text-[#067d62]">
                    {win.prize.valueNote}
                  </p>
                ) : null}
                <p className="mt-0.5 text-[10px] font-normal text-slate-600 sm:text-[11px]">
                  {formatDrawDate(win.draw.drawDate)} draw
                  {win.kind === "REFERRER" ? (
                    <span className="ml-1 inline-flex items-center gap-1 font-semibold text-sky-800">
                      <Users className="size-2.5" />
                      {referredFirstName(win)
                        ? `${referredFirstName(win)}, who you referred, won this`
                        : "won through someone you referred"}
                    </span>
                  ) : win.coupon ? (
                    <span className="ml-1 font-mono">· {win.coupon.code}</span>
                  ) : null}
                </p>
              </div>

              {win.status ? (
                <span className="shrink-0 self-start rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black uppercase text-slate-600">
                  {GIFT_FULFILMENT_LABELS[win.status] ?? win.status}
                </span>
              ) : null}
            </div>
          ))}

          {/* What happens next. The same promise the winner email makes, in the
              same words, because a customer who reads one and then the other
              must not be left wondering which of the two is current. */}
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-black uppercase tracking-wide text-emerald-900">
              📦 Collecting your prize
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-emerald-900 sm:text-xs">
              Our team will contact you <strong>within 2 working days</strong> on the phone number
              and email address we have for you, to arrange where and when to collect
              {multiple ? " your prizes" : " your prize"}. There is nothing to pay and nothing to do
              right now — just keep an eye on your phone.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * The same banner for /gifts, which does not know who is reading it.
 *
 * /gifts is public and revalidated every five minutes, so a win cannot be
 * rendered into it on the server without either leaking one customer's result
 * into another's cached copy or giving up the cache entirely. Fetching from the
 * browser after paint sidesteps both: the cached HTML stays impersonal, and the
 * banner appears only in the winner's own session.
 *
 * The session comes from the provider in the root layout, the same way
 * GiftCouponsCta reads it, so a signed-out visitor costs nothing at all — no
 * request is made.
 */
export function GiftWinBanner({ className = "" }) {
  const { session } = useSession();
  const [wins, setWins] = useState(null);

  useEffect(() => {
    if (!session) return undefined;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/user/gifts");
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) setWins(body.wins ?? []);
      } catch {
        // Offline, or the session expired between paint and fetch. The page is
        // a marketing page and reads perfectly without this block, so there is
        // nothing worth telling the visitor about.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  // Deciding which wins are still news belongs to GiftWinCelebration, so this
  // only has to answer "did the fetch come back with anything at all" — an old
  // or delivered win still arrives here and is dropped one level down.
  if (!wins || wins.length === 0) return null;

  return (
    <div className={className}>
      <GiftWinCelebration wins={wins} />
    </div>
  );
}
