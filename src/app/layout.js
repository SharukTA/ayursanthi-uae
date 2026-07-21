import { Inter, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { LenisProvider } from "@/components/LenisProvider";
import { ScrollProgress } from "@/components/ScrollProgress";
import { SessionProvider } from "@/components/SessionProvider";
import { getSession } from "@/lib/auth";
import "./globals.css";

// Amazon ships its proprietary "Amazon Ember" typeface, which can't be
// licensed/self-hosted here. Inter is the standard free, near-identical
// humanist sans used as its web substitute. It feeds the `--font-sans` token
// that globals.css maps every `font-sans` / heading utility to.
const interSans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Ayursanthi | Ayurveda Wellness Store",
  description:
    "Ayursanthi ecommerce platform for ayurvedic products, rewards, and customer wellness shopping.",
};

export default async function RootLayout({ children }) {
  // Resolve the session on the server so the first paint renders the correct
  // navbar/footer for this user — no client-side fetch flash on navigation.
  let initialSession = null;
  try {
    initialSession = await getSession();
  } catch (err) {
    initialSession = null;
  }

  return (
    <html
      lang="en"
      className={`${interSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider initialSession={initialSession}>
          <LenisProvider>
            <ScrollProgress />
            {children}
          </LenisProvider>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
