import { route, searchParams } from "@/server/api";
import { weeklyStats } from "@/server/services/stats";
import { getSettings } from "@/server/settings";
import { shiftWeeks, startOfLocalWeek, startOfNextLocalDay } from "@/domain/time";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const settings = await getSettings();
  const requested = Number(searchParams(request).get("weeks"));
  const weeks =
    Number.isFinite(requested) && requested >= 1 && requested <= 260
      ? Math.floor(requested)
      : settings.weeklyChartWeeks;

  const now = new Date();
  const thisWeekStart = startOfLocalWeek(now, settings.timezone);
  const from = shiftWeeks(thisWeekStart, settings.timezone, -(weeks - 1));
  // Exclusive end: the Monday after the current week.
  const to = shiftWeeks(thisWeekStart, settings.timezone, 1);

  return {
    weeks: await weeklyStats(from, to, settings.timezone),
    dailyGoalHours: settings.dailyGoalHours,
    requestedWeeks: weeks,
    // Not used by the chart, but keeps the response self-describing.
    generatedAt: startOfNextLocalDay(thisWeekStart, settings.timezone).toISOString(),
  };
});
