"use client";

import { dayKey as toDayKey, formatDayOfMonth, formatDurationHuman, formatWeekdayShort } from "@/domain/time";
import type { PositionedSegment } from "./geometry";
import { dayTotalMinutes } from "./geometry";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n-client";

interface MobileDayStripProps {
  days: Date[];
  tz: string;
  segments: Map<string, PositionedSegment[]>;
  mobileDayIndex: number | null;
  onSelectDay: (index: number) => void;
}

export function MobileDayStrip({
  days,
  tz,
  segments,
  mobileDayIndex,
  onSelectDay,
}: MobileDayStripProps) {
  const { locale } = useT();

  return (
    <div className="mb-2 grid grid-cols-7 gap-1">
      {days.map((day, index) => {
        const key = toDayKey(day, tz);
        const minutes = dayTotalMinutes(segments.get(key));
        const active = index === mobileDayIndex;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectDay(index)}
            className={cn(
              "rounded-lg border px-0.5 py-1.5 text-center transition",
              active
                ? "border-accent bg-accent-soft text-accent"
                : "border-border bg-surface text-fg-muted",
            )}
          >
            <span className="block text-[10px] uppercase">
              {formatWeekdayShort(day, tz, locale).slice(0, 1)}
            </span>
            <span className="block text-sm font-semibold">{formatDayOfMonth(day, tz)}</span>
            <span className="tabular block text-[9px] opacity-70">
              {minutes > 0 ? formatDurationHuman(minutes) : "-"}
            </span>
          </button>
        );
      })}
    </div>
  );
}