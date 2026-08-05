import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/shell/AppShell";
import { ServiceWorker } from "@/components/shell/ServiceWorker";
import { getLanguage, getTheme } from "@/server/settings";
import { isLang } from "@/lib/i18n";

// Theme is per-user in the Settings row; force-dynamic avoids Next baking the build-time palette into static HTML.
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
  // Read before paint so the first frame is already the right palette; System lets the OS media query decide, and a missing row or unreachable DB falls back rather than failing the page.
  let theme = "system";
  try {
    theme = await getTheme();
  } catch {
  }

  let language = "en";
  try {
    const lang = await getLanguage();
    if (isLang(lang)) language = lang;
  } catch {
  }

  return (
    <html lang={language} data-theme={theme === "system" ? undefined : theme}>
      <body className="min-h-full bg-bg text-fg">
        <Providers>
          <AppShell>{children}</AppShell>
          <ServiceWorker />
        </Providers>
      </body>
    </html>
  );
}
