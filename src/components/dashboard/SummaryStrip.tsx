"use client";

import { formatDurationHuman } from "@/domain/time";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n-client";
import type { SummaryStat } from "@/lib/types";

export function SummaryStrip({ summary }: { summary: SummaryStat | undefined }) {
  const total = summary?.totalMinutes ?? 0;
  const activeDays = summary?.activeDays ?? 0;
  const average = activeDays > 0 ? total / activeDays : 0;
  const { t, plural } = useT();

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Tile label={t("summary.total")} value={formatDurationHuman(total)} />
      <Tile
        label={t("summary.avg")}
        value={formatDurationHuman(average)}
        hint={plural(activeDays, "summary.avgHint.one", "summary.avgHint.other")}
      />
      {/* Odd tile out of a 2-up phone grid, so it takes the whole last row. */}
      <Tile
        label={t("summary.longest")}
        value={formatDurationHuman(summary?.longestDayMinutes ?? 0)}
        hint={summary?.longestDay ?? undefined}
        className="col-span-2 lg:col-span-1"
      />
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface px-3 py-2.5", className)}>
      <p className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className="mt-0.5 truncate text-lg font-semibold">{value}</p>
      {hint ? <p className="truncate text-[11px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
