"use client";

import { useMemo, useState } from "react";
import {
  useDailyStats,
  useProjectStats,
  useSettings,
  useWeeklyStats,
} from "@/lib/queries";
import {
  formatWeekdayShort,
  instantFromLocalParts,
  shiftWeeks,
  startOfLocalWeek,
} from "@/domain/time";
import { Spinner } from "@/components/ui/primitives";
import { HoursPerDayChart } from "./HoursPerDayChart";
import { HoursPerWeekChart } from "./HoursPerWeekChart";
import { ProjectDonut } from "./ProjectDonut";
import { SummaryStrip } from "./SummaryStrip";

type RangePreset = "week" | "month" | "quarter" | "year";

const RANGE_WEEKS: Record<RangePreset, number> = {
  week: 1,
  month: 4,
  quarter: 13,
  year: 52,
};

export function DashboardView() {
  const { data: settings, isLoading: settingsLoading } = useSettings();
  const tz = settings?.timezone ?? "UTC";
  const goalHours = settings?.dailyGoalHours ?? 8;

  const [weekCount, setWeekCount] = useState<number | null>(null);
  const [range, setRange] = useState<RangePreset>("month");

  const effectiveWeeks = weekCount ?? settings?.weeklyChartWeeks ?? 20;

  // Current week, for the per-day panel.
  const { weekStart, weekEnd } = useMemo(() => {
    const start = startOfLocalWeek(new Date(), tz);
    return { weekStart: start, weekEnd: shiftWeeks(start, tz, 1) };
  }, [tz]);

  // A wider window for the donut and the summary strip.
  const { rangeStart, rangeEnd } = useMemo(() => {
    const thisWeek = startOfLocalWeek(new Date(), tz);
    return {
      rangeStart: shiftWeeks(thisWeek, tz, -(RANGE_WEEKS[range] - 1)),
      rangeEnd: shiftWeeks(thisWeek, tz, 1),
    };
  }, [tz, range]);

  const daily = useDailyStats(weekStart, weekEnd);
  const weekly = useWeeklyStats(effectiveWeeks);
  const projects = useProjectStats(rangeStart, rangeEnd);
  const rangeSummary = useDailyStats(rangeStart, rangeEnd);

  if (settingsLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  const weekdayLabel = (dayKey: string) =>
    formatWeekdayShort(instantFromLocalParts(dayKey, 12 * 60, tz), tz);

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
          {(Object.keys(RANGE_WEEKS) as RangePreset[]).map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setRange(preset)}
              className={
                range === preset
                  ? "rounded-md bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
                  : "rounded-md px-2.5 py-1 text-xs text-fg-muted hover:text-fg"
              }
            >
              {preset === "week"
                ? "This week"
                : preset === "month"
                  ? "4 weeks"
                  : preset === "quarter"
                    ? "13 weeks"
                    : "52 weeks"}
            </button>
          ))}
        </div>
      </div>

      <SummaryStrip
        summary={rangeSummary.data?.summary}
        topProject={projects.data?.[0] ?? null}
        goalHours={goalHours}
        rangeWeeks={RANGE_WEEKS[range]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {daily.isLoading || !daily.data ? (
          <PanelSkeleton />
        ) : (
          <HoursPerDayChart
            days={daily.data.days}
            goalHours={goalHours}
            weekdayLabel={weekdayLabel}
          />
        )}

        {projects.isLoading || !projects.data ? (
          <PanelSkeleton />
        ) : (
          <ProjectDonut projects={projects.data} />
        )}
      </div>

      {weekly.isLoading || !weekly.data ? (
        <PanelSkeleton />
      ) : (
        <HoursPerWeekChart
          weeks={weekly.data.weeks}
          goalHours={goalHours}
          weekCount={effectiveWeeks}
          onWeekCountChange={setWeekCount}
        />
      )}

      <p className="text-xs text-fg-subtle">
        A running timer counts up to now, so today&apos;s numbers move as you work. Entries
        that cross midnight are split at the local day boundary, so each day gets its real
        share of the minutes.
      </p>
    </div>
  );
}

function PanelSkeleton() {
  return (
    <div className="flex h-72 items-center justify-center rounded-xl border border-border bg-surface">
      <Spinner />
    </div>
  );
}
