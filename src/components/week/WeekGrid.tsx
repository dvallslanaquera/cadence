"use client";

import type { RefObject } from "react";
import { dayKey as toDayKey, formatMinutesAsClock, wallClockMinutes } from "@/domain/time";
import { Spinner } from "@/components/ui/primitives";
import { DayColumn } from "./DayColumn";
import { NowLine } from "./NowLine";
import { GRID_MINUTES, type PositionedSegment } from "./geometry";

// Hours never change; the gutter label is a pure function of the hour, so precompute once.
const HOUR_LABELS: string[] = Array.from({ length: 24 }, (_, hour) =>
  hour === 0 ? "" : formatMinutesAsClock(hour * 60),
);

interface WeekGridProps {
  visibleDays: Date[];
  tz: string;
  segments: Map<string, PositionedSegment[]>;
  selectedEntryId: string | null;
  todayKey: string;
  hourHeight: number;
  pxPerMinute: number;
  now: Date;
  isDesktop: boolean;
  entriesLoading: boolean;
  scrollRef: RefObject<HTMLDivElement | null>;
  gridTemplate: string;
  onSelectEntry: (id: string | null) => void;
  onCreateRange: (dayKey: string, startMinutes: number, endMinutes: number) => void;
  onStartTimerAt: (dayKey: string, startMinutes: number) => void;
  onMoveEntry: (segment: PositionedSegment, deltaMinutes: number) => void | Promise<unknown>;
  onResizeEntry: (
    segment: PositionedSegment,
    edge: "start" | "end",
    deltaMinutes: number,
  ) => void | Promise<unknown>;
}

export function WeekGrid({
  visibleDays,
  tz,
  segments,
  selectedEntryId,
  todayKey,
  hourHeight,
  pxPerMinute,
  now,
  isDesktop,
  entriesLoading,
  scrollRef,
  gridTemplate,
  onSelectEntry,
  onCreateRange,
  onStartTimerAt,
  onMoveEntry,
  onResizeEntry,
}: WeekGridProps) {
  return (
    <div
      ref={scrollRef}
      className="scroll-thin relative flex-1 min-h-0 overflow-y-auto rounded-b-xl border-x border-b border-border bg-surface"
    >
      {entriesLoading ? (
        <div className="absolute right-3 top-3 z-30">
          <Spinner />
        </div>
      ) : null}

      <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
        <div className="relative" style={{ height: GRID_MINUTES * pxPerMinute }}>
          {HOUR_LABELS.map((label, hour) => (
            <div
              key={hour}
              className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular text-fg-subtle"
              style={{ top: hour * hourHeight }}
            >
              {label}
            </div>
          ))}
        </div>

        {visibleDays.map((day) => {
          const key = toDayKey(day, tz);
          const isToday = key === todayKey;
          return (
            <div key={key} className="relative">
              <DayColumn
                dayKey={key}
                segments={segments.get(key) ?? []}
                isToday={isToday}
                isDesktop={isDesktop}
                selectedEntryId={selectedEntryId}
                onSelectEntry={onSelectEntry}
                onCreateRange={onCreateRange}
                onStartTimerAt={onStartTimerAt}
                nowMinutes={isToday ? wallClockMinutes(now, tz) : null}
                onMoveEntry={onMoveEntry}
                onResizeEntry={onResizeEntry}
                pxPerMinute={pxPerMinute}
                hourHeight={hourHeight}
              />
              {isToday ? <NowLine now={now} tz={tz} pxPerMinute={pxPerMinute} /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}