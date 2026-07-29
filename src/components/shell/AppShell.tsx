"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, ListTodo, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { RunningBar } from "@/components/timer/RunningBar";

const tabs = [
  { href: "/", label: "Week", icon: CalendarDays },
  { href: "/backlog", label: "Backlog", icon: ListTodo },
  { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

/**
 * Navigation lives down the left edge on desktop and along the bottom on mobile,
 * so neither costs the week grid any height — the grid is the one view where
 * vertical space is the scarce resource. The timer strip is the only chrome
 * above the content, and it earns its row by being editable.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // The login page renders standalone — no nav, no timer bar.
  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-screen">
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
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto w-full max-w-[1400px] px-3 sm:px-5">
          <RunningBar />
        </div>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-3 pb-24 sm:px-5 md:pb-8">
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
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
