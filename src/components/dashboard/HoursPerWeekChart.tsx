"use client";

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDurationHuman, minutesToHours } from "@/domain/time";
import { axisTick, useChartTheme } from "./chartTheme";
import { ChartTooltip, DataTable, Panel } from "./Panel";
import { WeekCountInput } from "./WeekCountInput";
import { useT } from "@/lib/i18n-client";
import type { WeeklyStat } from "@/lib/types";

const ROLLING_WINDOW = 4;

export function HoursPerWeekChart({
  weeks,
  goalHours,
  weekCount,
  onWeekCountChange,
}: {
  weeks: WeeklyStat[];
  goalHours: number;
  weekCount: number;
  onWeekCountChange: (value: number) => void;
}) {
  const theme = useChartTheme();
  const { t } = useT();
  const weeklyGoal = goalHours * 5;

  const data = weeks.map((week, index) => {
    const window = weeks.slice(Math.max(0, index - ROLLING_WINDOW + 1), index + 1);
    const average =
      window.reduce((sum, item) => sum + item.minutes, 0) / Math.max(1, window.length);
    return {
      week: week.week,
      // Only the year-week suffix fits on the axis at 20 weeks.
      label: week.week.slice(5),
      hours: minutesToHours(week.minutes),
      minutes: week.minutes,
      average: minutesToHours(average),
    };
  });

  const maxHours = Math.max(weeklyGoal, ...data.map((d) => d.hours), 1);

  return (
    <Panel
      title={t("chart.perWeek.title")}
      subtitle={t("chart.perWeek.subtitle", { weeks: weekCount, goal: weeklyGoal })}
      controls={<WeekCountInput value={weekCount} onChange={onWeekCountChange} />}
      table={
        <DataTable
          head={[t("chart.perWeek.col.week"), t("chart.perWeek.col.tracked"), t("chart.perWeek.col.avg", { n: ROLLING_WINDOW })]}
          rows={data.map((d) => [d.week, formatDurationHuman(d.minutes), `${d.average}h`])}
        />
      }
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick(theme)}
              tickLine={false}
              axisLine={{ stroke: theme.axis }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              tick={axisTick(theme)}
              tickLine={false}
              axisLine={false}
              domain={[0, Math.ceil(maxHours)]}
              width={44}
              unit="h"
            />
            <Tooltip
              cursor={{ fill: theme.grid, opacity: 0.4 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const point = payload[0].payload as (typeof data)[number];
                return (
                  <ChartTooltip
                    label={point.week}
                    rows={[
                      {
                        name: t("chart.perWeek.series.tracked"),
                        value: formatDurationHuman(point.minutes),
                        color: theme.primary,
                      },
                      {
                        name: t("chart.perWeek.series.avg", { n: ROLLING_WINDOW }),
                        value: `${point.average}h`,
                        color: theme.secondary,
                      },
                    ]}
                  />
                );
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              height={24}
              iconType="circle"
              iconSize={8}
              formatter={(value) => (
                <span style={{ color: theme.secondaryInk, fontSize: 11 }}>{value}</span>
              )}
            />
            <ReferenceLine
              y={weeklyGoal}
              stroke={theme.reference}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Bar
              dataKey="hours"
              name={t("chart.perWeek.series.tracked")}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              fill={theme.primary}
            />
            <Line
              type="monotone"
              dataKey="average"
              name={t("chart.perWeek.series.avg", { n: ROLLING_WINDOW })}
              stroke={theme.secondary}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
