"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  Send,
  Loader2,
} from "lucide-react";
import { FadeIn, PageReveal, Stagger, StaggerItem } from "@/components/Animated";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SocialLinks } from "@/components/SocialLinks";
import { useSiteSettings } from "@/components/SettingsProvider";
import { Button } from "@/components/ui/button";
import { AnimatedHeading, AnimatedReveal } from "@/components/AnimatedText";
import { Tilt3D } from "@/components/Tilt3D";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  // Contact details are admin-managed (Site Settings). They arrive already
  // resolved from the root layout, so the cards below render filled in on the
  // first paint instead of flashing "—" while a fetch resolves.
  const s = useSiteSettings();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setLoading(true);
    setTimeout(() => {
      toast.success("Support ticket created! We will contact you within 24 hours.");
      setName("");
      setEmail("");
      setMessage("");
      setLoading(false);
    }, 1200);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-950 py-10 text-white sm:py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <PageReveal>
            <AnimatedHeading
              as="h1"
              text="Contact Support"
              className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
              highlightWords={["Support"]}
              highlightClassName=""
            />
            <AnimatedReveal delay={0.2}>
              <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
                Need assistance? Open a direct query ticket with our wellness coordinators and we&apos;ll get back to you within 24 hours.
              </p>
            </AnimatedReveal>
          </PageReveal>
        </div>
      </section>

      {/* Centered Form + Contact Info */}
      <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 flex-1">
        <div className="flex flex-col gap-8">
          <Tilt3D maxTilt={5} scale={1.01}>
            <FadeIn className="rounded-md border border-border bg-white p-5 shadow-sm sm:p-6">
              <AnimatedHeading
                as="h2"
                text="Send Us a Message"
                className="text-2xl font-bold text-slate-950"
                highlightWords={["Message"]}
                highlightClassName=""
              />
              <p className="mt-2 text-sm text-slate-600">
                Submit your query below and our team will get back to you shortly.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm font-semibold text-slate-800">
                  Full name
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    disabled={loading}
                    required
                    placeholder="Enter your name"
                    className="min-h-11 rounded-md border border-input bg-white px-4 text-sm font-normal outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-800">
                  Email address
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    required
                    placeholder="you@example.com"
                    className="min-h-11 rounded-md border border-input bg-white px-4 text-sm font-normal outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10"
                  />
                </label>

                <label className="grid gap-2 text-sm font-semibold text-slate-800">
                  Query Details
                  <textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={loading}
                    required
                    placeholder="How can we help you?"
                    className="rounded-md border border-input bg-white p-4 text-sm font-normal outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-700/10 resize-none"
                  />
                </label>

                <Button
                  type="submit"
                  disabled={loading}
                  className="h-11 bg-emerald-700 hover:bg-emerald-800 rounded-md"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin mr-2" />
                      Sending...
                    </>
                  ) : (
                    <>
                      Submit Query
                      <Send className="size-4 ml-2" />
                    </>
                  )}
                </Button>
              </form>
            </FadeIn>
          </Tilt3D>

          <Stagger className="grid gap-4 sm:grid-cols-2">
            <StaggerItem>
              <Tilt3D maxTilt={8} scale={1.03}>
                <div className="flex items-start gap-3 rounded-md border border-border bg-white p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#232f3e] text-white">
                    <Phone className="size-5" />
                  </span>
                  <div className="min-w-0 wrap-anywhere">
                    <h4 className="text-sm font-bold text-[#0f1111]">Call Center</h4>
                    <p className="mt-1 text-xs font-semibold text-[#3f4545]">{s.contact_phone || "—"}</p>
                    <p className="text-[10px] font-medium text-[#565959]">{s.contact_hours || ""}</p>
                  </div>
                </div>
              </Tilt3D>
            </StaggerItem>

            <StaggerItem>
              <Tilt3D maxTilt={8} scale={1.03}>
                <div className="flex items-start gap-3 rounded-md border border-border bg-white p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#232f3e] text-white">
                    <Mail className="size-5" />
                  </span>
                  <div className="min-w-0 wrap-anywhere">
                    <h4 className="text-sm font-bold text-[#0f1111]">Email Support</h4>
                    <p className="mt-1 text-xs font-semibold text-[#3f4545]">{s.contact_email || "—"}</p>
                    <p className="text-[10px] font-medium text-[#565959]">Response within 24h</p>
                  </div>
                </div>
              </Tilt3D>
            </StaggerItem>

            <StaggerItem>
              <Tilt3D maxTilt={8} scale={1.03}>
                <div className="flex items-start gap-3 rounded-md border border-border bg-white p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#232f3e] text-white">
                    <MapPin className="size-5" />
                  </span>
                  <div className="min-w-0 wrap-anywhere">
                    <h4 className="text-sm font-bold text-[#0f1111]">Office Head</h4>
                    <p className="mt-1 text-xs font-semibold text-[#3f4545]">{s.contact_company || "—"}</p>
                    <p className="text-[10px] font-medium text-[#565959]">{s.contact_address || ""}</p>
                  </div>
                </div>
              </Tilt3D>
            </StaggerItem>

            <StaggerItem>
              <Tilt3D maxTilt={8} scale={1.03}>
                <div className="flex items-start gap-3 rounded-md border border-border bg-white p-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-[#232f3e] text-white">
                    <Clock className="size-5" />
                  </span>
                  <div className="min-w-0 wrap-anywhere">
                    <h4 className="text-sm font-bold text-[#0f1111]">Fulfillment</h4>
                    <p className="mt-1 text-xs font-semibold text-[#3f4545]">{s.contact_dispatch || "—"}</p>
                    <p className="text-[10px] font-medium text-[#565959]">{s.contact_address || ""}</p>
                  </div>
                </div>
              </Tilt3D>
            </StaggerItem>
          </Stagger>

          {/* Renders nothing until an admin adds at least one social URL.
              Explicit hex colours here, not text-slate-*: this is a white
              surface, where globals.css flips the light text utilities to ink. */}
          <SocialLinks
            heading="Follow us"
            className="rounded-md border border-border bg-white p-4"
            headingClassName="text-sm font-bold text-[#0f1111]"
            linkClassName="text-[#565959] hover:text-[#0f1111]"
            iconClassName="size-6"
          />
        </div>
      </section>

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </main>
  );
}
