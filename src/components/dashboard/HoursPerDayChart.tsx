"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDurationHuman, minutesToHours } from "@/domain/time";
import { axisTick, useChartTheme } from "./chartTheme";
import { ChartTooltip, DataTable, Panel } from "./Panel";
import type { DailyStat } from "@/lib/types";

/**
 * Magnitude over an ordinal axis: bars. One series, so no legend box — the
 * title names it. The goal is a reference line, and the over/under delta is a
 * direct label under each bar.
 */
export function HoursPerDayChart({
  days,
  goalHours,
  weekdayLabel,
}: {
  days: DailyStat[];
  goalHours: number;
  weekdayLabel: (dayKey: string) => string;
}) {
  const theme = useChartTheme();

  const data = days.map((day) => {
    const hours = minutesToHours(day.minutes);
    return {
      day: day.day,
      label: weekdayLabel(day.day),
      hours,
      minutes: day.minutes,
      delta: Math.round((hours - goalHours) * 10) / 10,
    };
  });

  const maxHours = Math.max(goalHours, ...data.map((d) => d.hours), 1);

  return (
    <Panel
      title="Hours per day"
      subtitle={`Goal ${goalHours}h · dashed line`}
      table={
        <DataTable
          head={["Day", "Tracked", "vs goal"]}
          rows={data.map((d) => [
            d.label,
            formatDurationHuman(d.minutes),
            `${d.delta >= 0 ? "+" : ""}${d.delta}h`,
          ])}
        />
      }
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={axisTick(theme)}
              tickLine={false}
              axisLine={{ stroke: theme.axis }}
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
                    label={point.day}
                    rows={[
                      {
                        name: "Tracked",
                        value: formatDurationHuman(point.minutes),
                        color: theme.primary,
                      },
                      {
                        name: "vs goal",
                        value: `${point.delta >= 0 ? "+" : ""}${point.delta}h`,
                      },
                    ]}
                  />
                );
              }}
            />
            <ReferenceLine
              y={goalHours}
              stroke={theme.reference}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={44} fill={theme.primary}>
              {data.map((point) => (
                <Cell key={point.day} fill={theme.primary} />
              ))}
              <LabelList
                dataKey="delta"
                position="top"
                offset={6}
                fontSize={10}
                fill={theme.mutedInk}
                formatter={(value: number) =>
                  value === 0 ? "" : `${value > 0 ? "+" : ""}${value}`
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
