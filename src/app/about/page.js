import Link from "next/link";
import {
  HeartPulse,
  Leaf,
  Sparkles,
  Flame,
  Crown,
  Wind,
  Dumbbell,
  Smile,
  Eye,
  Droplet,
  Baby,
  UtensilsCrossed,
  Flower2,
} from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { AnimatedHeading, AnimatedReveal } from "@/components/AnimatedText";
import { Tilt3D } from "@/components/Tilt3D";
import { RichText } from "@/components/RichText";
import { getPage } from "@/lib/pages";

export const metadata = {
  title: "About Us | Ayursanthi",
  description:
    "Ayursanthi — a 400-year legacy of authentic Ayurveda, blending Jyothisham and rare manuscripts with modern science. Established 1960, Kerala, India.",
};

// The hero subtitle + brand-story prose are admin-editable (Pages panel); the
// rest of the layout is fixed brand structure.
export const revalidate = 300;

const productCategories = [
  { name: "Yuva Kalpa", english: "Health Care", icon: HeartPulse, tone: "border-emerald-200 bg-emerald-50/50 text-emerald-900" },
  { name: "Varna Kalpa", english: "Beauty Care", icon: Sparkles, tone: "border-rose-200 bg-rose-50/50 text-rose-900" },
  { name: "Kama Kalpa", english: "Sexual Care", icon: Flame, tone: "border-amber-200 bg-amber-50/50 text-amber-900" },
  { name: "Kanaka Kalpa", english: "Women's Care", icon: Crown, tone: "border-pink-200 bg-pink-50/50 text-pink-900" },
  { name: "Siro Kalpa", english: "Hair Care", icon: Wind, tone: "border-sky-200 bg-sky-50/50 text-sky-900" },
  { name: "Sthoola Kalpa", english: "Slim Care", icon: Dumbbell, tone: "border-indigo-200 bg-indigo-50/50 text-indigo-900" },
  { name: "Dandha Kalpa", english: "Dental Care", icon: Smile, tone: "border-teal-200 bg-teal-50/50 text-teal-900" },
  { name: "Netra Kalpa", english: "Eye Care", icon: Eye, tone: "border-violet-200 bg-violet-50/50 text-violet-900" },
  { name: "Meha Kalpa", english: "Diabetic Care", icon: Droplet, tone: "border-cyan-200 bg-cyan-50/50 text-cyan-900" },
  { name: "Sisu Kalpa", english: "Baby Care", icon: Baby, tone: "border-orange-200 bg-orange-50/50 text-orange-900" },
  { name: "Bhoja Kalpa", english: "Food Care", icon: UtensilsCrossed, tone: "border-lime-200 bg-lime-50/50 text-lime-900" },
  { name: "Sugandha Kalpa", english: "Perfumes", icon: Flower2, tone: "border-fuchsia-200 bg-fuchsia-50/50 text-fuchsia-900" },
];

export default async function AboutPage() {
  const page = await getPage("about");

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      {/* Hero Section */}
      <section
        className="relative overflow-hidden bg-slate-950 py-12 text-white sm:py-20"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(2,6,23,0.85), rgba(15,23,42,0.9)), url('https://images.pexels.com/photos/8469436/pexels-photo-8469436.jpeg?auto=compress&cs=tinysrgb&w=1600')",
          backgroundPosition: "center",
          backgroundSize: "cover",
        }}
      >
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <PageReveal>
            <span className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-sm font-semibold text-emerald-300 backdrop-blur">
              <Leaf className="size-4" />
              Our Story
            </span>
            <AnimatedHeading
              as="h1"
              text="About Ayursanthi"
              className="mt-5 text-3xl font-bold tracking-tight sm:mt-6 sm:text-5xl lg:text-6xl"
              highlightWords={["Ayursanthi"]}
              highlightClassName=""
            />
            <AnimatedReveal delay={0.3}>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                {page.subtitle}
              </p>
            </AnimatedReveal>
          </PageReveal>
        </div>
      </section>

      {/* Brand Profile Section */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <FadeIn>
            <AnimatedHeading
              as="h2"
              text={page.title}
              className="text-3xl font-bold tracking-tight text-[#0f1111] sm:text-4xl"
              highlightWords={["Legacy", "Ayurveda"]}
              highlightClassName=""
            />
            <AnimatedReveal delay={0.2}>
              <RichText
                body={page.body}
                className="mt-6 text-base leading-7 text-[#0f1111] sm:text-lg sm:leading-8"
              />
            </AnimatedReveal>
          </FadeIn>
          <Tilt3D maxTilt={10} scale={1.02}>
            <div className="relative aspect-video overflow-hidden rounded-md border border-border bg-slate-200 shadow-xl lg:aspect-square">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage:
                    "url('https://images.pexels.com/photos/4871365/pexels-photo-4871365.jpeg?auto=compress&cs=tinysrgb&w=900')",
                }}
              />
            </div>
          </Tilt3D>
        </div>
      </section>

      {/* Vision & Mission Grid */}
      <section className="bg-white border-y border-border py-10 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            <Tilt3D maxTilt={8} scale={1.02}>
              <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm sm:p-8">
                <span className="flex size-12 items-center justify-center rounded-md bg-emerald-700 text-white">
                  <Sparkles className="size-6" />
                </span>
                <h3 className="mt-6 text-2xl font-bold text-[#0f1111]">Our Vision</h3>
                <p className="mt-4 text-base leading-7 text-[#0f1111]">
                  Ayursanthi believes that by empowering people we can bring happiness and security. Whether you read to make a small change to improve the health condition may significantly transform the life pattern. Ayursanthi offers an opportunity to make a mark in the surging health and general wellness.
                </p>
              </FadeIn>
            </Tilt3D>

            <Tilt3D maxTilt={8} scale={1.02}>
              <FadeIn className="rounded-md border border-border bg-white p-6 shadow-sm sm:p-8">
                <span className="flex size-12 items-center justify-center rounded-md bg-emerald-700 text-white">
                  <HeartPulse className="size-6" />
                </span>
                <h3 className="mt-6 text-2xl font-bold text-[#0f1111]">Our Mission</h3>
                <p className="mt-4 text-base leading-7 text-[#0f1111]">
                  Your health, your time, your freedom and the opportunity to change your life is all in your hands. You have a chance to decide what kind of success you should achieve. You will definitely achieve during the course of your life and Ayursanthi has the tools and solutions to help. We are proud to offer exceptional products with antioxidant power and exciting weight management solutions. Everyone at Ayursanthi is dedicated to your ultimate success as a distributor — because for us, your goals are important; they're what add up to your better and secured future.
                </p>
              </FadeIn>
            </Tilt3D>
          </div>
        </div>
      </section>

      {/* Product Categories — Twelve Kalpas */}
      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8">
        <div className="text-center">
          <AnimatedHeading
            as="h2"
            text="The Twelve Kalpas of Wellness"
            className="text-3xl font-bold tracking-tight text-[#0f1111] sm:text-4xl"
            highlightWords={["Kalpas"]}
            highlightClassName=""
          />
          <AnimatedReveal delay={0.2}>
            <p className="mx-auto mt-4 max-w-2xl text-base text-[#0f1111]">
              Our product range spans twelve carefully crafted Kalpas — each one a complete category of authentic Ayurvedic care for every part of life.
            </p>
          </AnimatedReveal>
        </div>

        <Stagger className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {productCategories.map((cat) => {
            const Icon = cat.icon;
            return (
              <StaggerItem key={cat.name}>
                <Tilt3D maxTilt={8} scale={1.03} className="h-full">
                  <div
                    className={`group flex h-full items-center gap-4 rounded-md border p-5 shadow-sm transition-shadow hover:shadow-xl ${cat.tone}`}
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-white/70 transition-transform group-hover:scale-110">
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-base font-bold leading-tight">{cat.name}</h4>
                      <p className="mt-0.5 text-xs font-semibold opacity-75">{cat.english}</p>
                    </div>
                  </div>
                </Tilt3D>
              </StaggerItem>
            );
          })}
        </Stagger>

        <div className="mt-10 text-center sm:mt-12">
          <Button asChild className="h-12 bg-emerald-700 hover:bg-emerald-800 px-8 rounded-md">
            <Link href="/products">Explore Our Products</Link>
          </Button>
        </div>
      </section>

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </main>
  );
}
