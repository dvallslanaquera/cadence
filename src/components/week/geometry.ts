import { assignLanes, splitAcrossDays, type DaySegment } from "@/domain/layout";
import { minutesBetween, wallClockMinutes } from "@/domain/time";
import type { Entry } from "@/lib/types";

export interface PositionedSegment extends DaySegment {
  entry: Entry;
  running: boolean;
  /** Wall-clock minutes used for vertical placement. */
  topMinutes: number;
  bottomMinutes: number;
  /** Real elapsed minutes of this piece; what the label shows. */
  durationMinutes: number;
  lane: number;
  laneCount: number;
}

/** The grid is drawn as a fixed 24-hour column so it aligns with the gutter. */
export const GRID_MINUTES = 1440;

// Running entries are drawn as if they ended now, so the block grows as you work.
export function segmentsByDay(
  entries: Entry[],
  tz: string,
  now: Date,
): Map<string, PositionedSegment[]> {
  const byDay = new Map<string, PositionedSegment[]>();

  for (const entry of entries) {
    const start = new Date(entry.startedAt);
    const running = entry.endedAt === null;
    const end = running ? now : new Date(entry.endedAt as string);
    if (!(end > start)) continue;

    for (const segment of splitAcrossDays(start, end, tz)) {
      const topMinutes = wallClockMinutes(segment.startsAt, tz);
      // A segment ending at next midnight reads as 00:00; place it at the bottom of this day, not the top.
      const rawBottom = wallClockMinutes(segment.endsAt, tz);
      const bottomMinutes =
        segment.continuesAfter || rawBottom <= topMinutes ? GRID_MINUTES : rawBottom;

      const list = byDay.get(segment.dayKey) ?? [];
      list.push({
        ...segment,
        entry,
        running,
        topMinutes,
        bottomMinutes,
        durationMinutes: minutesBetween(segment.startsAt, segment.endsAt),
        lane: 0,
        laneCount: 1,
      });
      byDay.set(segment.dayKey, list);
    }
  }

  // Overlaps are rejected on write, so this is a safety net, not a routine layout step. See domain/layout.ts.
  for (const [key, list] of byDay) {
    // assignLanes sorts internally, so carry an index to map results back.
    const laned = assignLanes(
      list.map((item, index) => ({
        index,
        startMinutes: item.topMinutes,
        endMinutes: item.bottomMinutes,
      })),
    );

    const positioned = [...list];
    for (const item of laned) {
      positioned[item.index] = {
        ...positioned[item.index],
        lane: item.lane,
        laneCount: item.laneCount,
      };
    }
    byDay.set(key, positioned);
  }

  return byDay;
}

/** Total tracked minutes for a day, from the already-split segments. */
export function dayTotalMinutes(segments: PositionedSegment[] | undefined): number {
  if (!segments) return 0;
  return segments.reduce((sum, segment) => sum + segment.durationMinutes, 0);
}
