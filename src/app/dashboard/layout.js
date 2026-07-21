import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { DashboardSidebar } from "@/components/DashboardSidebar";

export const metadata = {
  title: "My Dashboard | Ayursanthi",
};

export default async function DashboardLayout({ children }) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-white flex flex-col">
      <SiteHeader />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[240px_1fr] lg:gap-8">
          <DashboardSidebar session={session} />
          <div className="min-w-0">{children}</div>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
