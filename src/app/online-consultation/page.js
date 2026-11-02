import { PageReveal } from "@/components/Animated";
import { AnimatedHeading, AnimatedReveal } from "@/components/AnimatedText";
import { ConsultationForm } from "@/components/ConsultationForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = {
  title: "Online Consultation | Ayurshoppee",
  description:
    "Share your skin, hair and health history with Ayurshanti Beauty Clinic and consult with us online through WhatsApp.",
};

export default function OnlineConsultationPage() {
  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-slate-950 py-10 text-white sm:py-16">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <PageReveal>
            <AnimatedHeading
              as="h1"
              text="Online Consultation"
              className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl"
              highlightWords={["Consultation"]}
              highlightClassName=""
            />
            <AnimatedReveal delay={0.2}>
              <p className="mx-auto mt-4 max-w-xl text-base text-slate-300">
                Fill in your details below and send them to our clinic on WhatsApp.
              </p>
            </AnimatedReveal>
          </PageReveal>
        </div>
      </section>

      <ConsultationForm />

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </main>
  );
}
