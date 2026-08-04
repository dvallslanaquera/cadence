"use client";

import { useMemo } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatDurationHuman } from "@/domain/time";
import { NEUTRAL_COLOR } from "@/lib/constants";
import { useChartTheme } from "./chartTheme";
import { ChartTooltip, DataTable, Panel } from "./Panel";
import { useT } from "@/lib/i18n-client";
import type { ProjectStat } from "@/lib/types";

/**
 * Identity, so colour is categorical and follows the project — never its rank,
 * so filtering the range never repaints the survivors.
 *
 * Beyond seven projects the tail folds into "Other" rather than inventing hues
 * the palette hasn't validated.
 */
const MAX_SLICES = 7;

export function ProjectDonut({ projects }: { projects: ProjectStat[] }) {
  const theme = useChartTheme();
  const { t } = useT();

  const { slices, total } = useMemo(() => {
    const sorted = [...projects].sort((a, b) => b.minutes - a.minutes);
    const head = sorted.slice(0, MAX_SLICES);
    const tail = sorted.slice(MAX_SLICES);

    const folded =
      tail.length > 0
        ? [
            {
              projectId: "__other__",
              name: t("donut.other", { n: tail.length }),
              color: NEUTRAL_COLOR,
              minutes: tail.reduce((sum, item) => sum + item.minutes, 0),
            },
          ]
        : [];

    const all = [...head, ...folded];
    return { slices: all, total: all.reduce((sum, item) => sum + item.minutes, 0) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, t]);

  if (total === 0) {
    return (
      <Panel title={t("donut.title")} subtitle={t("donut.empty.title")}>
        <div className="flex h-56 items-center justify-center text-sm text-fg-subtle">
          {t("donut.empty.body")}
        </div>
      </Panel>
    );
  }

  const share = (minutes: number) => Math.round((minutes / total) * 1000) / 10;

  return (
    <Panel
      title={t("donut.title")}
      subtitle={t("donut.subtitle", { n: formatDurationHuman(total) })}
      table={
        <DataTable
          head={[t("donut.col.project"), t("donut.col.tracked"), t("donut.col.share")]}
          rows={slices.map((slice) => [
            slice.name,
            formatDurationHuman(slice.minutes),
            `${share(slice.minutes)}%`,
          ])}
        />
      }
    >
      <div className="flex flex-col items-center gap-3 sm:flex-row">
        <div className="h-56 w-full sm:w-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={slices}
                dataKey="minutes"
                nameKey="name"
                innerRadius="58%"
                outerRadius="88%"
                paddingAngle={2}
                stroke={theme.surface}
                strokeWidth={2}
              >
                {slices.map((slice) => (
                  <Cell key={slice.projectId} fill={theme.series(slice.color)} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const slice = payload[0].payload as (typeof slices)[number];
                  return (
                    <ChartTooltip
                      label={slice.name}
                      rows={[
                        {
                          name: t("donut.col.tracked"),
                          value: formatDurationHuman(slice.minutes),
                          color: theme.series(slice.color),
                        },
                        { name: t("donut.col.share"), value: `${share(slice.minutes)}%` },
                      ]}
                    />
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* The legend carries hours and share, so identity and magnitude are
            both readable without relying on the colour alone. */}
        <ul className="w-full min-w-0 flex-1 space-y-1">
          {slices.map((slice) => (
            <li key={slice.projectId} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: theme.series(slice.color) }}
              />
              <span className="min-w-0 flex-1 truncate text-fg">{slice.name}</span>
              <span className="tabular text-fg-muted">
                {formatDurationHuman(slice.minutes)}
              </span>
              <span className="tabular w-12 text-right text-fg-subtle">
                {share(slice.minutes)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}
