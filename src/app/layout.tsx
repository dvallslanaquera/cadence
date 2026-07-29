import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/shell/AppShell";
import { ServiceWorker } from "@/components/shell/ServiceWorker";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-full bg-bg text-fg">
        <Providers>
          <AppShell>{children}</AppShell>
          <ServiceWorker />
        </Providers>
      </body>
    </html>
  );
}
