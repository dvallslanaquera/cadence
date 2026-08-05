/** Entries <-> rectangles. Pure arithmetic, no React or Prisma (ARCHITECTURE.md §5, §8). */
import {
  dayKey,
  localDayLengthMinutes,
  minutesBetween,
  startOfLocalDay,
  startOfNextLocalDay,
} from "./time";

export interface DaySegment {
  /** "2026-07-28"; the local day this segment belongs to. */
  dayKey: string;
  /** Instant of that day's local midnight. */
  dayStart: Date;
  /** The clipped instants this segment actually covers. */
  startsAt: Date;
  endsAt: Date;
  /** Elapsed minutes from local midnight; for durations, not layout. */
  startMinutes: number;
  endMinutes: number;
  /** 1440, except on DST transition days. */
  dayLengthMinutes: number;
  /** The entry began on an earlier day / ends on a later one. */
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Guard against an absurd span turning into an unbounded loop. */
const MAX_SEGMENTS = 400;

/** One segment per local day, so a 22:00 -> 02:00 entry draws at the bottom of Tuesday and the top of Wednesday; each day gets its real share of minutes. */
export function splitAcrossDays(start: Date, end: Date, tz: string): DaySegment[] {
  if (!(end > start)) return [];

  const segments: DaySegment[] = [];
  let dayStart = startOfLocalDay(start, tz);

  while (dayStart < end && segments.length < MAX_SEGMENTS) {
    const nextDay = startOfNextLocalDay(dayStart, tz);
    // A malformed zone could return a non-advancing day; refuse to spin.
    if (nextDay <= dayStart) break;

    const segStart = start > dayStart ? start : dayStart;
    const segEnd = end < nextDay ? end : nextDay;

    if (segEnd > segStart) {
      segments.push({
        dayKey: dayKey(dayStart, tz),
        dayStart,
        startsAt: segStart,
        endsAt: segEnd,
        startMinutes: minutesBetween(dayStart, segStart),
        endMinutes: minutesBetween(dayStart, segEnd),
        dayLengthMinutes: localDayLengthMinutes(dayStart, tz),
        continuesBefore: start < dayStart,
        continuesAfter: end > nextDay,
      });
    }

    dayStart = nextDay;
  }

  return segments;
}

/** Total minutes of an entry that fall inside one local day. */
export function minutesOnDay(start: Date, end: Date, dayStart: Date, tz: string): number {
  const nextDay = startOfNextLocalDay(dayStart, tz);
  const from = start > dayStart ? start : dayStart;
  const to = end < nextDay ? end : nextDay;
  return to > from ? minutesBetween(from, to) : 0;
}

export interface Block {
  top: number;
  height: number;
}

/** Minimum drawn height so a 1-minute entry is still clickable. */
const MIN_BLOCK_PX = 14;

/** Positions use the caller's minute scale; the grid passes wall-clock minutes so the hour gutter stays honest across DST. */
export function segmentToBlock(
  startMinutes: number,
  endMinutes: number,
  pxPerMinute: number,
): Block {
  return {
    top: startMinutes * pxPerMinute,
    height: Math.max(MIN_BLOCK_PX, (endMinutes - startMinutes) * pxPerMinute),
  };
}

/** Inverse: a pointer offset within a day column becomes minutes from midnight. */
export function pixelsToMinutes(
  offsetPx: number,
  pxPerMinute: number,
  snapMinutes: number,
  dayLengthMinutes: number,
): number {
  const raw = offsetPx / pxPerMinute;
  const snapped = Math.round(raw / snapMinutes) * snapMinutes;
  return Math.min(Math.max(snapped, 0), dayLengthMinutes);
}

/** Block a double-click creates: defaultMinutes long, starting at the pointer. Clipped to the next entry because the DB rejects overlaps outright (ARCHITECTURE.md §4); a 10-min gap yields a 10-min entry, not a failed write. Null when no room, so the caller no-ops instead of erroring. */
export function blockFromClick(
  atMinutes: number,
  occupied: readonly { startMinutes: number; endMinutes: number }[],
  defaultMinutes: number,
  dayLengthMinutes: number,
): { startMinutes: number; endMinutes: number } | null {
  if (atMinutes >= dayLengthMinutes) return null;

  // Clicking inside an existing block is that block's own gesture, not a create.
  if (occupied.some((slot) => atMinutes >= slot.startMinutes && atMinutes < slot.endMinutes)) {
    return null;
  }

  const nextStart = occupied
    .map((slot) => slot.startMinutes)
    .filter((start) => start > atMinutes)
    .reduce((min, start) => Math.min(min, start), Infinity);

  const endMinutes = Math.min(atMinutes + defaultMinutes, nextStart, dayLengthMinutes);
  if (endMinutes - atMinutes < 1) return null;

  return { startMinutes: atMinutes, endMinutes };
}

export type ClickIntent =
  | { kind: "start"; startMinutes: number }
  | { kind: "block"; startMinutes: number; endMinutes: number };

/**
 * Double-click on empty grid usually means "doing this now": a live timer from
 * the clicked minute. Falls back to a fixed block unless all three hold: the
 * column is today (can't be doing something last week), the minute is at or
 * before now (ahead of the now-line is planning), and nothing is logged later
 * (a timer with no end would run through it). nowMinutes is null for non-today
 * columns; null when no room for anything.
 */
export function intentFromClick(
  atMinutes: number,
  occupied: readonly { startMinutes: number; endMinutes: number }[],
  options: {
    nowMinutes: number | null;
    defaultMinutes: number;
    dayLengthMinutes: number;
  },
): ClickIntent | null {
  const { nowMinutes, defaultMinutes, dayLengthMinutes } = options;

  const block = blockFromClick(atMinutes, occupied, defaultMinutes, dayLengthMinutes);
  if (!block) return null;

  const nothingAfter = occupied.every((slot) => slot.endMinutes <= atMinutes);
  if (nowMinutes !== null && atMinutes <= nowMinutes && nothingAfter) {
    return { kind: "start", startMinutes: atMinutes };
  }

  return { kind: "block", ...block };
}

export interface Laned {
  lane: number;
  laneCount: number;
}

/** Overlaps are rejected on write, so everything lands in lane 0 in practice. This is a fallback so a stray overlap renders side by side instead of hiding another entry. */
export function assignLanes<T extends { startMinutes: number; endMinutes: number }>(
  items: T[],
): (T & Laned)[] {
  const sorted = [...items].sort(
    (a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
  );

  const result: (T & Laned)[] = [];
  let cluster: (T & Laned)[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    for (const item of cluster) {
      item.laneCount = cluster.reduce((max, other) => Math.max(max, other.lane + 1), 1);
    }
    result.push(...cluster);
    cluster = [];
    clusterEnd = -Infinity;
  };

  for (const item of sorted) {
    if (item.startMinutes >= clusterEnd && cluster.length > 0) flush();

    const taken = new Set(
      cluster.filter((other) => other.endMinutes > item.startMinutes).map((o) => o.lane),
    );
    let lane = 0;
    while (taken.has(lane)) lane++;

    cluster.push({ ...item, lane, laneCount: 1 });
    clusterEnd = Math.max(clusterEnd, item.endMinutes);
  }
  if (cluster.length > 0) flush();

  return result;
}
