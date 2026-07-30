/**
 * Turning entries into rectangles, and back again. Pure arithmetic — no React,
 * no Prisma. See ARCHITECTURE.md §5 and §8.
 */
import {
  dayKey,
  localDayLengthMinutes,
  minutesBetween,
  startOfLocalDay,
  startOfNextLocalDay,
} from "./time";

export interface DaySegment {
  /** "2026-07-28" — the local day this piece of the entry belongs to. */
  dayKey: string;
  /** Instant of that day's local midnight. */
  dayStart: Date;
  /** The clipped instants this segment actually covers. */
  startsAt: Date;
  endsAt: Date;
  /** Elapsed minutes from local midnight — used for durations, not for layout. */
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

/**
 * Split an entry into one segment per local day it touches, so a 22:00 -> 02:00
 * entry draws at the bottom of Tuesday and the top of Wednesday, and each day's
 * total gets its real share of the minutes.
 */
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

// ---------------------------------------------------------------------------
// Pixel geometry
// ---------------------------------------------------------------------------

export interface Block {
  top: number;
  height: number;
}

/** Minimum drawn height so a 1-minute entry is still clickable. */
const MIN_BLOCK_PX = 14;

/**
 * Positions are given in whatever minute scale the caller is using — the grid
 * passes wall-clock minutes so the hour gutter stays honest across DST.
 */
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

/**
 * The block a plain click should create: `defaultMinutes` long, starting where
 * the pointer landed.
 *
 * Clipped to whatever comes next, because the database rejects overlaps
 * outright (ARCHITECTURE.md §4) — clicking into a 10-minute gap has to produce
 * a 10-minute entry, not a failed write. Returns null when the click leaves no
 * room at all, so the caller can do nothing rather than show an error.
 */
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
 * What a plain click on empty grid means.
 *
 * Usually it means "I am doing this now", so it starts a live timer at the minute
 * you clicked and the entry runs until you stop it. That is the whole reason to
 * click the grid rather than fill in a form. Three things have to hold for that
 * reading to be true, and when any of them fails the click falls back to logging
 * a fixed block instead:
 *
 *   - the column is today, because you cannot currently be doing something on
 *     Tuesday last week;
 *   - the minute is at or before now, for the same reason in the other
 *     direction, since clicking ahead of the now-line is planning rather than
 *     tracking;
 *   - nothing is logged later that day, since a timer with no end would run
 *     straight through it.
 *
 * `nowMinutes` is null for any column that is not today. Returns null when the
 * click leaves no room for anything at all.
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

// ---------------------------------------------------------------------------
// Lane packing
// ---------------------------------------------------------------------------

export interface Laned {
  lane: number;
  laneCount: number;
}

/**
 * Overlaps are rejected on write, so in practice everything lands in lane 0.
 * This exists so that if a stray overlap ever does reach the grid it renders
 * side by side instead of one entry hiding another.
 */
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
