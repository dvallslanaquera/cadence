import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/shell/AppShell";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import { getTheme } from "@/server/settings";

// The theme lives in the Settings row and changes per user, so the layout must
// render per request. Without this, Next prerenders the pages at build time and
// bakes whatever theme was current then into the static HTML; the first frame
// on every later visit would be stale (the build-time palette, not the user's),
// with the right one only flashing in once the client settings query resolves.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cadence",
  description: "Time tracking and a backlog, for one person.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Cadence", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read before paint so the first frame is already the right palette; System
  // sets no attribute and lets the OS media query decide. A missing row or an
  // unreachable database falls back to System rather than failing the page.
  let theme = "system";
  try {
    theme = await getTheme();
  } catch {
    // leave System
  }

  return (
    <html lang="en" data-theme={theme === "system" ? undefined : theme}>
      <body className="min-h-full bg-bg text-fg">
        <Providers>
          <AppShell>{children}</AppShell>
          <ServiceWorker />
        </Providers>
      </body>
    </html>
  );
}
