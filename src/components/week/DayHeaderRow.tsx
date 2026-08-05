"use client";

import { dayKey as toDayKey, formatDayOfMonth, formatDurationHuman, formatWeekdayShort } from "@/domain/time";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n-client";
import type { Task } from "@/lib/types";
import { DayTaskStrip } from "./DayTaskStrip";
import { dayTotalMinutes, type PositionedSegment } from "./geometry";

interface DayHeaderRowProps {
  visibleDays: Date[];
  tz: string;
  segments: Map<string, PositionedSegment[]>;
  tasksByDay: Map<string, Task[]>;
  todayKey: string;
  gridTemplate: string;
  onQuickStart: (task?: Task) => void;
}

export function DayHeaderRow({
  visibleDays,
  tz,
  segments,
  tasksByDay,
  todayKey,
  gridTemplate,
  onQuickStart,
}: DayHeaderRowProps) {
  const { locale } = useT();

  return (
    <div
      className="grid border-b border-border bg-bg/95"
      style={{ gridTemplateColumns: gridTemplate }}
    >
      <div />
      {visibleDays.map((day) => {
        const key = toDayKey(day, tz);
        const minutes = dayTotalMinutes(segments.get(key));
        const isToday = key === todayKey;
        return (
          <div key={key} className="border-l border-border px-1 py-1.5">
            <div className="flex items-baseline justify-center gap-1.5">
              <span
                className={cn(
                  "text-xs font-medium uppercase",
                  isToday ? "text-accent" : "text-fg-muted",
                )}
              >
                {formatWeekdayShort(day, tz, locale)}
              </span>
              <span
                className={cn(
                  "text-lg font-semibold",
                  isToday &&
                    "flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-fg",
                )}
              >
                {formatDayOfMonth(day, tz)}
              </span>
            </div>
            {/* Full-strength fg, not the subtle token: the number you actually read. */}
            <div className="tabular mt-0.5 text-center text-xs font-medium text-fg">
              {minutes > 0 ? formatDurationHuman(minutes) : "-"}
            </div>

            <DayTaskStrip dayKey={key} tasks={tasksByDay.get(key) ?? []} onStart={onQuickStart} />
          </div>
        );
      })}
    </div>
  );
}