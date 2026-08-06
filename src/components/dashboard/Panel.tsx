"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ErrorState, Spinner } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n-client";

export function Panel({
  title,
  subtitle,
  controls,
  children,
  table,
  className,
}: {
  title: string;
  subtitle?: string;
  controls?: ReactNode;
  children: ReactNode;
  /** The relief channel: every chart's numbers are readable without colour. */
  table?: ReactNode;
  className?: string;
}) {
  const { t } = useT();
  return (
    <section
      className={cn("rounded-xl border border-border bg-surface p-4", className)}
    >
      <header className="mb-3 flex flex-wrap items-start gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">{title}</h2>
          {subtitle ? <p className="text-xs text-fg-subtle">{subtitle}</p> : null}
        </div>
        {controls ? <div className="ml-auto flex items-center gap-1.5">{controls}</div> : null}
      </header>

      {children}

      {table ? (
        <details className="mt-3 border-t border-border pt-2">
          <summary className="cursor-pointer text-xs text-fg-muted hover:text-fg">
            {t("panel.showNumbers")}
          </summary>
          <div className="mt-2 overflow-x-auto">{table}</div>
        </details>
      ) : null}
    </section>
  );
}

export function DataTable({
  head,
  rows,
}: {
  head: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-left text-xs">
      <thead>
        <tr className="text-fg-subtle">
          {head.map((cell) => (
            <th key={cell} className="py-1 pr-4 font-medium">
              {cell}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular">
        {rows.map((row, index) => (
          <tr key={index} className="border-t border-border">
            {row.map((cell, cellIndex) => (
              <td key={cellIndex} className="py-1 pr-4">
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Shared tooltip shell, so all three panels look like one instrument. */
export function ChartTooltip({
  label,
  rows,
}: {
  label: string;
  rows: { name: string; value: string; color?: string }[];
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5 shadow-[var(--shadow)]">
      <p className="mb-0.5 text-[11px] font-medium text-fg">{label}</p>
      {rows.map((row) => (
        <p key={row.name} className="flex items-center gap-1.5 text-[11px] text-fg-muted">
          {row.color ? (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: row.color }}
            />
          ) : null}
          {row.name}
          <span className="tabular ml-auto pl-3 font-medium text-fg">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

/** Panel-sized placeholder while a chart's data loads. */
export function PanelSkeleton() {
  return (
    <div className="flex h-72 items-center justify-center rounded-xl border border-border bg-surface">
      <Spinner />
    </div>
  );
}

/** Panel-sized failure box, so one dead query says so instead of holding the skeleton forever. */
export function PanelError({ onRetry }: { onRetry: () => void }) {
  const { t } = useT();
  return (
    <ErrorState
      className="flex h-72 flex-col items-center justify-center"
      title={t("error.title")}
      hint={t("error.hint")}
      retryLabel={t("error.retry")}
      onRetry={onRetry}
    />
  );
}
