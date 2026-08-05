"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, ListTodo, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RunningBar } from "@/components/timer/RunningBar";
import { ThemeSync } from "@/components/settings/ThemeSync";
import { useT } from "@/lib/i18n-client";

const tabs = [
  { href: "/", nav: "week", icon: CalendarDays },
  { href: "/backlog", nav: "backlog", icon: ListTodo },
  { href: "/dashboard", nav: "dashboard", icon: BarChart3 },
  { href: "/settings", nav: "settings", icon: Settings2 },
];

// Nav lives left on desktop, bottom on mobile to keep the week grid's vertical space; the timer strip is the only chrome above content and is editable.
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { t } = useT();

  if (pathname === "/login") return <>{children}</>;

  const navLabel = (id: string) => t(`nav.${id}`);

  return (
    <div className="flex min-h-screen">
      <ThemeSync />
      <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col border-r border-border bg-surface/60 px-4 py-5 md:flex">
        <Link href="/" className="mb-6 flex items-center gap-2.5 px-2 text-lg font-semibold">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <CalendarDays className="h-5 w-5" />
          </span>
          Cadence
        </Link>

        <nav className="flex flex-col gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                )}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                {navLabel(tab.nav)}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-5">
          <RunningBar />
        </div>

        <main className="mx-auto flex w-full max-w-[1400px] flex-1 min-h-0 flex-col px-3 pb-24 sm:px-5 md:pb-8">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition",
                  active ? "text-accent" : "text-fg-subtle",
                )}
              >
                <Icon className="h-5 w-5" />
                {navLabel(tab.nav)}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
