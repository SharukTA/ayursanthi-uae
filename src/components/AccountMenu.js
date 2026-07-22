"use client";

import { useEffect } from "react";
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
  LayoutTemplate,
  FolderTree,
  Package,
  FileText,
  Settings,
} from "lucide-react";
import { useSession } from "@/components/SessionProvider";

// Mirrors the dashboard sidebar so the header account menu and the dashboard
// page stay in sync.
const customerNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/profile", label: "My Profile", icon: User },
  { href: "/dashboard/orders", label: "My Orders", icon: ShoppingBag },
  { href: "/dashboard/change-password", label: "Change Password", icon: KeyRound },
];

// Mirrors the admin console quick-nav so the header account menu matches the
// /admin dashboard for signed-in administrators.
const adminNavItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/home", label: "Home Builder", icon: LayoutTemplate },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/products", label: "Inventory", icon: Package },
  { href: "/admin/pages", label: "Pages & FAQ", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

// Right-side slide-over showing the signed-in user's account links. Driven by
// the account control in the header (open/onClose lifted to SiteHeader).
export function AccountMenu({ open, onClose, onBrowse }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useSession();
  const isAdmin = session?.role === "ADMIN";
  const navItems = isAdmin ? adminNavItems : customerNavItems;

  // Close on route change.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Lock background scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleLogout = async () => {
    const toastId = toast.loading("Logging you out...");
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      toast.success("Logged out successfully.", { id: toastId });
      window.dispatchEvent(new Event("authUpdate"));
      onClose();
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Logout failed. Please try again.", { id: toastId });
    }
  };

  return (
    <AnimatePresence>
      {open && session && (
        <>
          {/* Dimmed backdrop — tap to close. Plain dim, no blur, matching the
              hamburger menu. */}
          <motion.button
            type="button"
            aria-label="Close account menu"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-black/50"
          />

          {/* Floating close (X) in the transparent strip, top-LEFT — the drawer
              opens from the right, so the close mirrors the hamburger menu's. */}
          <motion.button
            type="button"
            aria-label="Close account menu"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed left-3 top-3 z-80 flex size-10 items-center justify-center rounded-full text-white transition hover:bg-white/15"
          >
            <X className="size-7" />
          </motion.button>

          {/* Sliding panel — same white panel + teal header as the hamburger
              drawer, mirrored to slide in from the right. */}
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 right-0 z-[70] flex h-dvh w-3/4 max-w-sm flex-col bg-white shadow-2xl"
          >
            {/* Teal header: greeting on the left, a Browse button on the right
                that swaps over to the hamburger menu (Amazon-style). */}
            <div className="flex items-center justify-between gap-3 bg-[#232f3e] px-4 py-3 text-white">
              <p className="min-w-0 truncate text-base font-bold">
                Hello, {session?.name}
              </p>
              <button
                type="button"
                onClick={onBrowse}
                className="inline-flex shrink-0 items-center gap-1.5 rounded border border-white/40 px-2.5 py-1.5 text-xs font-bold text-white transition hover:border-white hover:bg-[#ffffff1a]"
                aria-label="Browse menu"
              >
                Browse
                <Menu className="size-4" />
              </button>
            </div>

            {/* Scrollable body. `min-h-0` lets this flex child shrink and scroll
                inside the fixed-height drawer. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.exact
                  ? pathname === item.href
                  : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-4 py-3 text-[15px] font-semibold transition hover:bg-[#f7fafa] ${
                      isActive ? "bg-[#f7fafa] text-[#0f1111]" : "text-[#0f1111]"
                    }`}
                  >
                    <Icon className="size-5 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}

              <div className="mt-1 border-t border-[#d5d9d9]">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 px-4 py-3 text-[15px] font-semibold text-rose-600 transition hover:bg-rose-50"
                >
                  <LogOut className="size-5 shrink-0" />
                  Log Out
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
