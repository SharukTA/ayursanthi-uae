"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "motion/react";
import { Users, ShoppingBag, Gift } from "lucide-react";
import { FadeIn, Stagger, StaggerItem } from "@/components/Animated";

// Community proof points shown under the "Deals just for you" section. Counts
// are real values queried from the database and passed in as props by the page.
// Explicit #0f1111 ink text is used so the numbers stay readable on the white
// page background (the global palette remaps light text utilities to ink).

// Counts up from 0 to `value` once the element scrolls into view.
function CountUp({ value }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 2,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (latest) => setDisplay(Math.floor(latest)),
    });
    return () => controls.stop();
  }, [inView, value]);

  return <span ref={ref}>{display.toLocaleString("en-IN")}</span>;
}

export function StatsSection({
  registeredCount = 0,
  bookingsCount = 0,
  rewardsCount = 0,
}) {
  const stats = [
    {
      icon: Users,
      value: registeredCount,
      label: "Registered customers",
      text: "People who joined the Ayursanthi community.",
    },
    {
      icon: ShoppingBag,
      value: bookingsCount,
      label: "Products booked",
      text: "Checkouts completed with a successful payment.",
    },
    {
      icon: Gift,
      value: rewardsCount,
      label: "Rewards earned",
      text: "Members who unlocked referral rewards.",
    },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
      <FadeIn className="text-center">
        <p className="text-sm font-bold uppercase tracking-wider text-[#565959]">
          Trusted by our community
        </p>
        <h2 className="mt-2 text-3xl font-bold text-[#0f1111] sm:text-4xl">
          Growing every day
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm text-[#565959]">
          Thousands of people register, book products, and earn rewards with Ayursanthi.
        </p>
      </FadeIn>

      <Stagger className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <StaggerItem key={stat.label}>
              <div className="flex h-full flex-col items-center rounded-xl border border-border bg-white p-6 text-center shadow-sm transition-shadow hover:shadow-2xl">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#f7fafa]">
                  <Icon className="size-6 text-[#0f1111]" />
                </span>
                <p className="mt-4 text-4xl font-bold text-[#0f1111] sm:text-5xl">
                  <CountUp value={stat.value} />
                </p>
                <p className="mt-2 text-base font-bold text-[#0f1111]">
                  {stat.label}
                </p>
                <p className="mt-1 text-sm text-[#565959]">{stat.text}</p>
              </div>
            </StaggerItem>
          );
        })}
      </Stagger>
    </section>
  );
}
