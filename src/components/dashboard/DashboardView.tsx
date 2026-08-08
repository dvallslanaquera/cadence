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
  shiftDays,
  shiftMonths,
  shiftWeeks,
  shiftYears,
  startOfLocalDay,
  startOfLocalMonth,
  startOfLocalWeek,
  startOfLocalYear,
} from "@/domain/time";
import { ErrorState, Spinner } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n-client";
import { HoursPerDayChart } from "./HoursPerDayChart";
import { HoursPerWeekChart } from "./HoursPerWeekChart";
import { PanelError, PanelSkeleton } from "./Panel";
import { ProjectDonut } from "./ProjectDonut";
import { RangePresets, type RangePreset } from "./RangePresets";
import { SummaryStrip } from "./SummaryStrip";

// Half-open [start, end). Calendar presets run to the end of the current week/month/year, matching how "this week" already shows days that haven't happened yet.
function rangeFor(preset: RangePreset, now: Date, tz: string): { start: Date; end: Date } {
  switch (preset) {
    case "week": {
      const start = startOfLocalWeek(now, tz);
      return { start, end: shiftWeeks(start, tz, 1) };
    }
    case "month": {
      const start = startOfLocalMonth(now, tz);
      return { start, end: shiftMonths(start, tz, 1) };
    }
    case "last30": {
      const today = startOfLocalDay(now, tz);
      return { start: shiftDays(today, tz, -29), end: shiftDays(today, tz, 1) };
    }
    case "year": {
      const start = startOfLocalYear(now, tz);
      return { start, end: shiftYears(start, tz, 1) };
    }
  }
}

export function DashboardView() {
  const {
    data: settings,
    isLoading: settingsLoading,
    isError: settingsError,
    refetch: refetchSettings,
  } = useSettings();
  const tz = settings?.timezone ?? "UTC";
  const goalHours = settings?.dailyGoalHours ?? 8;
  const { t, locale } = useT();

  const [weekCount, setWeekCount] = useState<number | null>(null);
  const [range, setRange] = useState<RangePreset>("week");

  const effectiveWeeks = weekCount ?? settings?.weeklyChartWeeks ?? 20;

  const { weekStart, weekEnd } = useMemo(() => {
    const start = startOfLocalWeek(new Date(), tz);
    return { weekStart: start, weekEnd: shiftWeeks(start, tz, 1) };
  }, [tz]);

  // Wider window for the donut and summary strip.
  const { rangeStart, rangeEnd } = useMemo(() => {
    const { start, end } = rangeFor(range, new Date(), tz);
    return { rangeStart: start, rangeEnd: end };
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

  // Every panel below is bucketed by the stored timezone, so falling back to UTC here would chart the wrong days rather than admit the read failed.
  if (settingsError || !settings) {
    return (
      <div className="py-4">
        <ErrorState
          title={t("error.title")}
          hint={t("error.hint")}
          retryLabel={t("error.retry")}
          onRetry={() => void refetchSettings()}
        />
      </div>
    );
  }

  const weekdayLabel = (dayKey: string) =>
    formatWeekdayShort(instantFromLocalParts(dayKey, 12 * 60, tz), tz, locale);

  return (
    <div className="space-y-4 py-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">{t("dash.heading")}</h1>
        <RangePresets value={range} onChange={setRange} />
      </div>

      <SummaryStrip summary={rangeSummary.data?.summary} />

      <div className="grid gap-4 lg:grid-cols-2">
        {daily.isLoading ? (
          <PanelSkeleton />
        ) : daily.isError || !daily.data ? (
          <PanelError onRetry={() => void daily.refetch()} />
        ) : (
          <HoursPerDayChart
            days={daily.data.days}
            goalHours={goalHours}
            weekdayLabel={weekdayLabel}
          />
        )}

        {projects.isLoading ? (
          <PanelSkeleton />
        ) : projects.isError || !projects.data ? (
          <PanelError onRetry={() => void projects.refetch()} />
        ) : (
          <ProjectDonut projects={projects.data} />
        )}
      </div>

      {weekly.isLoading ? (
        <PanelSkeleton />
      ) : weekly.isError || !weekly.data ? (
        <PanelError onRetry={() => void weekly.refetch()} />
      ) : (
        <HoursPerWeekChart
          weeks={weekly.data.weeks}
          goalHours={goalHours}
          weekCount={effectiveWeeks}
          onWeekCountChange={setWeekCount}
        />
      )}
    </div>
  );
}
