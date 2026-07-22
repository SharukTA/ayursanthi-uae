"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  LayoutDashboard,
  User,
  ShoppingBag,
  KeyRound,
  LogOut,
  Menu,
  X,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/profile", label: "My Profile", icon: User },
  { href: "/dashboard/orders", label: "My Orders", icon: ShoppingBag },
  { href: "/dashboard/change-password", label: "Change Password", icon: KeyRound },
];

function SidebarBody({ session, pathname, onLogout, onLinkClick }) {
  return (
    <>
      {/* User info card */}
      <div className="rounded-md border border-border bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 text-base font-extrabold shrink-0">
            {session?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-900 truncate">{session?.name}</p>
            <p className="text-[11px] text-slate-500 truncate">{session?.email}</p>
            <span className="inline-block mt-1 rounded bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-800 uppercase tracking-wide">
              {session?.role ?? "Customer"}
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="mt-3 rounded-md border border-border bg-white shadow-sm overflow-hidden">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={`flex items-center gap-3 px-4 py-3 text-sm font-medium border-b border-slate-100 last:border-0 transition-colors ${
                isActive
                  ? "bg-emerald-50 text-emerald-800 font-semibold border-l-2 border-l-emerald-700"
                  : "text-slate-700 hover:bg-slate-50 hover:text-emerald-800"
              }`}
            >
              <Icon className="size-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}

        <button
          onClick={onLogout}
          className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors border-t border-slate-100"
        >
          <LogOut className="size-4 shrink-0" />
          Log Out
        </button>
      </nav>
    </>
  );
}

export function DashboardSidebar({ session }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeItem =
    navItems.find((item) =>
      item.exact ? pathname === item.href : pathname.startsWith(item.href)
    ) ?? navItems[0];

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    const toastId = toast.loading("Logging you out...");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out successfully.", { id: toastId });
      window.dispatchEvent(new Event("authUpdate"));
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Logout failed. Please try again.", { id: toastId });
    }
  };

  const ActiveIcon = activeItem.icon;

  return (
    <>
      {/* Mobile trigger bar — visible below lg */}
      <div className="lg:hidden mb-4 flex items-center justify-between gap-3 rounded-md border border-border bg-white px-3 py-2.5 shadow-sm">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2.5 text-sm font-bold text-slate-800"
          aria-label="Open dashboard menu"
        >
          <span className="flex size-9 items-center justify-center rounded-md bg-emerald-100 text-emerald-800">
            <Menu className="size-4" />
          </span>
          <span className="flex flex-col items-start leading-tight">
            <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
              Dashboard
            </span>
            <span className="flex items-center gap-1.5">
              <ActiveIcon className="size-3.5 text-emerald-700" />
              {activeItem.label}
            </span>
          </span>
        </button>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-800">
          {session?.name?.charAt(0)?.toUpperCase() ?? "U"}
        </span>
      </div>

      {/* Desktop sidebar — visible lg+ */}
      <aside className="hidden lg:flex lg:flex-col">
        <SidebarBody
          session={session}
          pathname={pathname}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile slide-out drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-sm lg:hidden"
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
              className="fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-sm flex-col gap-3 overflow-y-auto bg-slate-50 p-4 shadow-2xl lg:hidden"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  My Account
                </p>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex size-9 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition"
                  aria-label="Close menu"
                >
                  <X className="size-4" />
                </button>
              </div>
              <SidebarBody
                session={session}
                pathname={pathname}
                onLogout={handleLogout}
                onLinkClick={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
