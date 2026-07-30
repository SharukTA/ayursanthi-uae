import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { getPage } from "@/lib/pages";
import { AmazonTermsView } from "@/components/AmazonTermsView";

export const metadata = {
  title: "Terms & Conditions | Ayursanthi",
  description: "Terms and conditions, purchase policies, and cancellation parameters for the Ayursanthi wellness platform.",
};

// Admin-editable page content (lib/pages.js falls back to defaults if unedited).
export const revalidate = 300;

export default async function TermsPage() {
  const page = await getPage("terms");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <SiteHeader />

      <div className="flex-1">
        <AmazonTermsView page={page} />
      </div>

      <div className="mt-auto">
        <SiteFooter />
      </div>
    </main>
  );
}
