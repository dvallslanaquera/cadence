"use client";

import { formatDurationHuman, minutesToHours } from "@/domain/time";
import { ColorDot } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n-client";
import type { ProjectStat, SummaryStat } from "@/lib/types";

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
  const { t, plural } = useT();

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile label={t("summary.total")} value={formatDurationHuman(total)} />
      <Tile
        label={t("summary.avg")}
        value={formatDurationHuman(average)}
        hint={plural(activeDays, "summary.avgHint.one", "summary.avgHint.other")}
      />
      <Tile
        label={t("summary.longest")}
        value={formatDurationHuman(summary?.longestDayMinutes ?? 0)}
        hint={summary?.longestDay ?? undefined}
      />
      <Tile
        label={t("summary.topProject")}
        value={topProject?.name ?? "-"}
        hint={topProject ? formatDurationHuman(topProject.minutes) : undefined}
        dot={topProject?.color}
      />

      <div className="col-span-2 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-fg-muted lg:col-span-4">
        {plural(
          rangeWeeks,
          "summary.goal.one",
          "summary.goal.other",
          { goal: goalHours, weeks: rangeWeeks, vsGoal: `${vsGoal >= 0 ? "+" : ""}${vsGoal}h` },
        )}
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
