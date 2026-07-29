"use client";

import { formatDurationHuman, minutesToHours } from "@/domain/time";
import { ColorDot } from "@/components/ui/primitives";
import type { ProjectStat, SummaryStat } from "@/lib/types";

/**
 * Not a chart — four single numbers, so they get stat tiles rather than a plot.
 * Values wear text tokens; the only colour is the dot next to the project name.
 */
export function SummaryStrip({
  summary,
  topProject,
  goalHours,
  rangeWeeks,
}: {
  summary: SummaryStat | undefined;
  topProject: ProjectStat | null;
  goalHours: number;
  rangeWeeks: number;
}) {
  const total = summary?.totalMinutes ?? 0;
  const activeDays = summary?.activeDays ?? 0;
  const average = activeDays > 0 ? total / activeDays : 0;
  const goalMinutes = goalHours * 60 * 5 * rangeWeeks;
  const vsGoal = minutesToHours(total - goalMinutes);

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label="Total tracked" value={formatDurationHuman(total)} />
      <Tile
        label="Average per active day"
        value={formatDurationHuman(average)}
        hint={`${activeDays} day${activeDays === 1 ? "" : "s"} with time`}
      />
      <Tile
        label="Longest day"
        value={formatDurationHuman(summary?.longestDayMinutes ?? 0)}
        hint={summary?.longestDay ?? undefined}
      />
      <Tile
        label="Most tracked project"
        value={topProject?.name ?? "—"}
        hint={topProject ? formatDurationHuman(topProject.minutes) : undefined}
        dot={topProject?.color}
      />

      <div className="col-span-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg-muted lg:col-span-4">
        Against a {goalHours}h/day goal over {rangeWeeks} week
        {rangeWeeks === 1 ? "" : "s"} of weekdays, that is{" "}
        <span className="tabular font-medium text-fg">
          {vsGoal >= 0 ? "+" : ""}
          {vsGoal}h
        </span>
        .
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  hint,
  dot,
}: {
  label: string;
  value: string;
  hint?: string;
  dot?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-fg-subtle">{label}</p>
      <p className="mt-0.5 flex items-center gap-1.5 truncate text-lg font-semibold">
        {dot ? <ColorDot color={dot} /> : null}
        {value}
      </p>
      {hint ? <p className="truncate text-[11px] text-fg-subtle">{hint}</p> : null}
    </div>
  );
}
