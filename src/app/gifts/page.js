import Link from "next/link";
import { Gift, Lock, LockOpen, Trophy, Users, ShoppingBag, ArrowRight, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  countQualifyingReferrals,
  getReferralThreshold,
  hasPurchased,
} from "@/lib/gift-draws";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { NextDrawProgress } from "@/components/NextDrawProgress";
import { GiftsHero } from "@/components/GiftsHero";
import { FadeIn, Stagger, StaggerItem, LiftCard } from "@/components/Animated";

export const metadata = {
  title: "Gift Draws | Ayursanthi",
  description:
    "Shop and refer friends to enter Ayursanthi's milestone gift draws — smart watches, phones, gold coins, cars and more.",
};

// Re-query at most once per 5 minutes; the catalog changes rarely and the
// personalised panel is computed per request from the session anyway.
export const revalidate = 300;

export default async function GiftsPage() {
  const session = await getSession();

  const tiers = await prisma.giftTier.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { memberThreshold: "asc" }],
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });

  // Personalised status for a logged-in customer (admins just browse the catalog).
  let me = null;
  if (session?.userId && session.role !== "ADMIN") {
    const threshold = await getReferralThreshold();
    const [purchased, qualifyingReferrals, wins] = await Promise.all([
      hasPurchased(prisma, session.userId),
      countQualifyingReferrals(prisma, session.userId),
      prisma.giftWin.findMany({
        where: { userId: session.userId, status: { not: "REJECTED" } },
        orderBy: { createdAt: "desc" },
        select: { id: true, giftName: true, quantity: true, status: true, isReferrerMirror: true },
      }),
    ]);
    me = {
      purchased,
      qualifyingReferrals,
      threshold,
      eligible: purchased && qualifyingReferrals >= threshold,
      wins,
    };
  }

  // Prize highlights for the hero collage + marquee — favour ones with images.
  const allItems = tiers.flatMap((t) => t.items);
  const heroPrizes = [
    ...allItems.filter((i) => i.imageUrl),
    ...allItems.filter((i) => !i.imageUrl),
  ]
    .slice(0, 10)
    .map((i) => ({ name: i.name, imageUrl: i.imageUrl }));

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteHeader />

      <GiftsHero prizes={heroPrizes} giftCount={allItems.length} tierCount={tiers.length} />

      <section className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        {/* Personalised status */}
        <StatusPanel session={session} me={me} />

        {/* Live community progress toward the next milestone draw. Renders
            nothing when there is no pending draw, so it is safe to always mount. */}
        <FadeIn className="mt-6">
          <NextDrawProgress tone="light" />
        </FadeIn>

        {/* How it works — always shown, so the page feels complete even when
            no milestone is close. */}
        <HowItWorks />

        {/* Catalog */}
        <div id="catalog" className="mt-14 scroll-mt-24">
          <FadeIn className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800">
              <Gift className="size-3.5" /> The prize vault
            </span>
            <h2 className="mt-3 text-2xl font-extrabold text-foreground sm:text-3xl">
              Every milestone, a new set of prizes
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
              The more our community grows, the bigger the rewards. Here&apos;s what&apos;s
              waiting at each milestone.
            </p>
          </FadeIn>

          {tiers.length === 0 ? (
            <p className="mt-10 rounded-2xl border border-dashed border-border bg-white p-12 text-center text-sm text-slate-500">
              The gift catalog is being prepared — check back soon.
            </p>
          ) : (
            <div className="mt-10 flex flex-col gap-8">
              {tiers.map((tier, idx) => (
                <FadeIn key={tier.id}>
                  <TierBlock tier={tier} index={idx} />
                </FadeIn>
              ))}
            </div>
          )}
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

// One milestone tier: a numbered marker, the threshold, and its gift grid.
function TierBlock({ tier, index }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-slate-50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#0e3a38] text-sm font-extrabold text-white">
            {index + 1}
          </span>
          <div>
            <h3 className="text-lg font-extrabold leading-tight text-foreground">
              {tier.label || `${tier.memberThreshold.toLocaleString()} Members`}
            </h3>
            <p className="text-xs font-semibold text-slate-500">
              {tier.items.length} {tier.items.length === 1 ? "prize" : "prizes"} in this draw
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
          <Users className="size-3.5" />
          Draws at {tier.memberThreshold.toLocaleString()} paying members
        </span>
      </div>

      {tier.items.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm italic text-slate-500">
          Gifts for this milestone coming soon.
        </p>
      ) : (
        <Stagger className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3 lg:grid-cols-4">
          {tier.items.map((item) => (
            <StaggerItem key={item.id} className="h-full">
              <LiftCard className="group flex h-full flex-col overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:shadow-lg">
                <div className="relative aspect-square w-full overflow-hidden bg-slate-100">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="size-full object-cover transition duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-slate-400">
                      <Gift className="size-10" />
                    </span>
                  )}
                  {/* gradient scrim so the badge reads on any image */}
                  <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                  {item.quantity > 1 ? (
                    <span className="absolute right-2 top-2 rounded-full bg-[#0e3a38] px-2 py-0.5 text-[11px] font-extrabold text-white shadow">
                      ×{item.quantity}
                    </span>
                  ) : null}
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-[#0f1111] shadow">
                    <Sparkles className="size-3" /> 2× win
                  </span>
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <p className="text-sm font-bold text-foreground">{item.name}</p>
                  {item.description ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{item.description}</p>
                  ) : null}
                  <p className="mt-auto pt-2 text-[11px] font-semibold text-emerald-700">
                    Winner gets {item.quantity} · referrer gets {item.quantity} too
                  </p>
                </div>
              </LiftCard>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}

// Static three-step explainer. Always visible, so a first-time visitor
// immediately understands the program regardless of their progress.
function HowItWorks() {
  const steps = [
    {
      icon: ShoppingBag,
      title: "Shop a product",
      body: "Make any purchase to become a paying member — that's your ticket in.",
    },
    {
      icon: Users,
      title: "Refer friends who shop",
      body: "Share your code. Each friend who buys pushes you toward the draw.",
    },
    {
      icon: Trophy,
      title: "Win at every milestone",
      body: "Eligible members are drawn at each milestone — and your referrer wins too.",
    },
  ];
  return (
    <div className="mt-12">
      <FadeIn className="text-center">
        <h2 className="text-2xl font-extrabold text-foreground sm:text-3xl">How the draws work</h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          Three simple steps stand between you and the prize vault.
        </p>
      </FadeIn>
      <Stagger className="mt-8 grid gap-4 sm:grid-cols-3">
        {steps.map((s, i) => (
          <StaggerItem key={s.title} className="h-full">
            <div className="relative flex h-full flex-col rounded-2xl border border-border bg-white p-6 shadow-sm">
              <span className="absolute right-5 top-5 text-4xl font-black text-slate-100">{i + 1}</span>
              <span className="flex size-12 items-center justify-center rounded-xl bg-[#0e3a38] text-white">
                <s.icon className="size-6" />
              </span>
              <p className="mt-4 text-base font-extrabold text-foreground">{s.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{s.body}</p>
            </div>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  );
}

function StatusPanel({ session, me }) {
  // Logged out
  if (!session?.userId) {
    return (
      <FadeIn className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <Lock className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-foreground">Sign in to take part</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Create a free account, shop, and refer friends who shop to enter the draws.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Sign in <ArrowRight className="size-4" />
          </Link>
        </div>
      </FadeIn>
    );
  }

  // Admin
  if (session.role === "ADMIN" || !me) {
    return (
      <FadeIn className="rounded-xl border border-border bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-fuchsia-50 text-fuchsia-700">
            <Gift className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-foreground">You manage the gift draws</p>
            <p className="mt-0.5 text-sm text-slate-500">
              Build milestone tiers, add gifts, and run each draw from the admin panel.
            </p>
          </div>
          <Link
            href="/admin/gift-draws"
            className="inline-flex h-11 items-center gap-2 rounded-md bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Manage gift draws <ArrowRight className="size-4" />
          </Link>
        </div>
      </FadeIn>
    );
  }

  const { purchased, qualifyingReferrals, threshold, eligible, wins } = me;
  const have = Math.min(qualifyingReferrals, threshold);
  const pct = threshold > 0 ? Math.round((have / threshold) * 100) : 0;
  const remaining = Math.max(0, threshold - qualifyingReferrals);
  const unclaimed = wins.filter((w) => w.status === "WON").length;

  if (eligible) {
    return (
      <FadeIn className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-xl bg-emerald-600 text-white">
            <LockOpen className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-emerald-900">You&apos;re entered in the gift draws 🎉</p>
            <p className="mt-0.5 text-sm text-emerald-800">
              {wins.length > 0
                ? `You've won ${wins.length} gift${wins.length === 1 ? "" : "s"}${unclaimed > 0 ? ` — ${unclaimed} awaiting your address.` : "."}`
                : "Winners are drawn at each milestone. Good luck!"}
            </p>
          </div>
          {wins.length > 0 ? (
            <Link
              href="/dashboard/rewards"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
            >
              <Trophy className="size-4" /> My wins
            </Link>
          ) : null}
        </div>
      </FadeIn>
    );
  }

  return (
    <FadeIn className="rounded-xl border border-border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <Lock className="size-6" />
        </span>
        <div>
          <p className="text-base font-bold text-foreground">Unlock the gift draws</p>
          <p className="mt-0.5 text-sm text-slate-500">Two steps to enter every milestone draw.</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-lg border border-border p-4">
          <ShoppingBag className={`size-5 ${purchased ? "text-emerald-600" : "text-slate-500"}`} />
          <div>
            <p className="text-sm font-bold text-foreground">1. Purchase a product</p>
            <p className="text-xs text-slate-500">{purchased ? "Done ✓" : "Not yet"}</p>
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          <div className="flex items-center justify-between text-sm font-bold text-foreground">
            <span className="flex items-center gap-2">
              <Users className="size-5 text-emerald-600" /> 2. Refer {threshold} who shop
            </span>
            <span className="text-xs text-slate-500">{have}/{threshold}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/referrals"
          className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-700 px-5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Share my referral code <ArrowRight className="size-4" />
        </Link>
        <span className="text-xs font-semibold text-slate-500">
          {remaining > 0
            ? `Refer ${remaining} more friend${remaining === 1 ? "" : "s"} who shop to unlock.`
            : "Make a purchase to unlock."}
        </span>
      </div>
    </FadeIn>
  );
}
