"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, User } from "lucide-react";
import { useSession } from "@/components/SessionProvider";
import { clearGuestCart, notifyCartChanged } from "@/lib/cart-client";

export function HeaderAuth({ onOpenMenu } = {}) {
  const router = useRouter();
  const { session } = useSession();

  const handleLogout = async () => {
    const toastId = toast.loading("Logging you out of your session...");
    try {
      const res = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error("Logout request failed.");
      }

      // The cart stays safely on the account; the browser copy must not outlive
      // the session (see AccountMenu).
      clearGuestCart();
      notifyCartChanged();
      toast.success("Successfully logged out.", { id: toastId });
      window.dispatchEvent(new Event("authUpdate"));
      router.push("/");
      router.refresh();
    } catch (err) {
      toast.error("Logout failed. Please try again.", { id: toastId });
    }
  };

  if (!session) {
    // Amazon-style desktop auth: a "Hello, sign in / Account" stack and a
    // "Your / Orders" stack. Both send signed-out visitors to /login.
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/login"
          className="rounded border border-transparent px-2 py-1 leading-tight text-[#ffffff] transition hover:border-white/40"
        >
          <span className="block text-[11px] text-white/80">Hello, sign in</span>
          <span className="block text-sm font-bold text-[#ffffff]">Account</span>
        </Link>
        <Link
          href="/login"
          className="rounded border border-transparent px-2 py-1 leading-tight text-[#ffffff] transition hover:border-white/40"
        >
          <span className="block text-[11px] text-white/80">Your</span>
          <span className="block text-sm font-bold text-[#ffffff]">Orders</span>
        </Link>
      </div>
    );
  }

  const isAdmin = session.role === "ADMIN";
  const portalUrl = isAdmin ? "/admin" : "/dashboard";
  const ordersUrl = isAdmin ? "/admin/orders" : "/dashboard/orders";

  // Name sits to the LEFT of the icon; the icon comes last.
  const accountContent = (
    <>
      <span className="max-w-[100px] truncate hidden sm:inline-block">
        {session.name}
      </span>
      <User className="size-4 text-[#ffffff]" />
      {isAdmin && (
        <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-black text-[#0f1111]">
          ADMIN
        </span>
      )}
    </>
  );

  // Main header: below lg the slide-over drawer (with logout) handles the
  // account; on laptop/desktop we mirror Amazon — a "Hello, {name} / Account"
  // stack followed by a "Your / Orders" stack, and NO logout icon (logout
  // lives inside the portal/account menu instead).
  if (onOpenMenu) {
    return (
      <div className="flex items-center gap-1">
        {/* Below lg: opens the right-side account drawer (which has logout). */}
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[#ffffff] hover:text-white/80 transition lg:hidden"
          aria-label="Open account menu"
        >
          {accountContent}
        </button>

        {/* lg and up: Amazon-style account + Your Orders stacks. */}
        <Link
          href={portalUrl}
          className="hidden rounded border border-transparent px-2 py-1 leading-tight text-[#ffffff] transition hover:border-white/40 lg:block"
        >
          <span className="block max-w-[120px] truncate text-[11px] text-white/80">
            Hello, {session.name}
          </span>
          <span className="flex items-center gap-1 text-sm font-bold text-[#ffffff]">
            Account
            {isAdmin && (
              <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-black text-[#0f1111]">
                ADMIN
              </span>
            )}
          </span>
        </Link>
        <Link
          href={ordersUrl}
          className="hidden rounded border border-transparent px-2 py-1 leading-tight text-[#ffffff] transition hover:border-white/40 lg:block"
        >
          <span className="block text-[11px] text-white/80">Your</span>
          <span className="block text-sm font-bold text-[#ffffff]">Orders</span>
        </Link>
      </div>
    );
  }

  // Drawer usage (no onOpenMenu) — e.g. inside the mobile hamburger drawer.
  // This sits on the drawer's WHITE panel, so the portal link, name and logout
  // icon use ink (#0f1111) instead of white — white-on-white is invisible.
  // `[&_*]:text-[#0f1111]` also recolors the shared accountContent's white User
  // icon, which is otherwise hardcoded for the navy header bars.
  return (
    <div className="flex items-center gap-3 text-[#0f1111] [&_*]:text-[#0f1111]">
      <Link
        href={portalUrl}
        className="inline-flex items-center gap-1.5 text-xs font-bold transition hover:text-[#007185]"
      >
        {accountContent}
      </Link>

      <button
        onClick={handleLogout}
        className="flex size-9 items-center justify-center rounded border border-[#d5d9d9] transition hover:border-[#adb1b8] hover:bg-[#f7fafa]"
        title="Logout Account"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}

// Compact, icon-first auth control for the mobile top bar (Amazon-style).
// Logged out -> a single "Sign in" button with a user icon.
// Logged in  -> the account icon linking to the portal (logout lives in the drawer).
export function MobileHeaderAuth({ onOpenMenu } = {}) {
  const { session } = useSession();

  if (!session) {
    return (
      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 rounded border border-white/50 px-2.5 py-2 text-xs font-bold text-white transition hover:bg-[#ffffff] hover:text-[#007185]"
      >
        <User className="size-4.5" />
        <span>Sign in</span>
      </Link>
    );
  }

  const isAdmin = session.role === "ADMIN";
  const portalUrl = isAdmin ? "/admin" : "/dashboard";

  // When wired with onOpenMenu, the account control shows the user's name to
  // the LEFT of the icon and opens the slide-over drawer (same as the
  // hamburger) instead of navigating straight to the portal.
  if (onOpenMenu) {
    return (
      <button
        type="button"
        onClick={onOpenMenu}
        className="inline-flex items-center gap-1.5 rounded border border-white/40 px-2.5 py-2 text-white transition hover:border-white hover:bg-[#ffffff1a]"
        title={session.name}
        aria-label="Open account menu"
      >
        <span className="max-w-[110px] truncate text-xs font-bold">
          {session.name}
        </span>
        <User className="size-5" />
      </button>
    );
  }

  return (
    <Link
      href={portalUrl}
      className="flex size-10 items-center justify-center rounded border border-white/40 text-white transition hover:border-white hover:bg-[#ffffff1a]"
      title={session.name}
      aria-label="Your account"
    >
      <User className="size-5" />
    </Link>
  );
}
