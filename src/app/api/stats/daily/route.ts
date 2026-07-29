import { requiredDate, route, searchParams } from "@/server/api";
import { dailyStats, summaryStats } from "@/server/services/stats";
import { getSettings } from "@/server/settings";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const params = searchParams(request);
  const from = requiredDate(params, "from");
  const to = requiredDate(params, "to");
  const settings = await getSettings();

  const [days, summary] = await Promise.all([
    dailyStats(from, to, settings.timezone),
    summaryStats(from, to, settings.timezone),
  ]);

  return { days, summary, dailyGoalHours: settings.dailyGoalHours };
});
