"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useSession } from "@/components/SessionProvider";

// The footer's bottom-bar auth line. Signed out -> "Already a customer? Sign
// in"; signed in -> a greeting with a Sign out button, mirroring the header.
export function FooterAuth() {
  const router = useRouter();
  const { session } = useSession();

  const handleLogout = async () => {
    const toastId = toast.loading("Logging you out...");
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error("Logout request failed.");
      toast.success("Successfully logged out.", { id: toastId });
      window.dispatchEvent(new Event("authUpdate"));
      router.push("/");
      router.refresh();
    } catch {
      toast.error("Logout failed. Please try again.", { id: toastId });
    }
  };

  if (!session) {
    return (
      <p className="text-sm text-white">
        Already a customer?{" "}
        <Link href="/login" className="font-medium text-white hover:underline">
          Sign in
        </Link>
      </p>
    );
  }

  return (
    <p className="text-sm text-white">
      Signed in as {session.name}.{" "}
      <button
        type="button"
        onClick={handleLogout}
        className="font-medium text-white hover:underline"
      >
        Sign out
      </button>
    </p>
  );
}
