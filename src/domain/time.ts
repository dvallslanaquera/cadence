/**
 * All wall-clock reasoning goes through here; formatting a Date elsewhere is how
 * a laptop in another country renders the wrong week (ARCHITECTURE.md §5).
 * Instants are UTC Dates; the home zone is a parameter, never ambient state.
 */
import { TZDate } from "@date-fns/tz";
import {
  addDays,
  addWeeks,
  getISOWeek,
  getISOWeekYear,
  startOfDay,
  startOfISOWeek,
} from "date-fns";

export const MS_PER_MINUTE = 60_000;

const pad = (n: number, width = 2) => String(n).padStart(width, "0");

/** Round to the nearest minute. Every persisted timestamp passes through here. */
export function roundToMinute(instant: Date): Date {
  return new Date(Math.round(instant.getTime() / MS_PER_MINUTE) * MS_PER_MINUTE);
}

export function addMinutes(instant: Date, minutes: number): Date {
  return new Date(instant.getTime() + minutes * MS_PER_MINUTE);
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / MS_PER_MINUTE);
}

/** The instant of local midnight for whichever local day `instant` falls in. */
export function startOfLocalDay(instant: Date, tz: string): Date {
  return new Date(startOfDay(new TZDate(instant, tz)).getTime());
}

/** Next day's local midnight. Calendar arithmetic, not +24h, so DST days are 23 or 25h. */
export function startOfNextLocalDay(dayStart: Date, tz: string): Date {
  return new Date(addDays(new TZDate(dayStart, tz), 1).getTime());
}

/** Length of the local day starting at dayStart; 1440 except across DST. */
export function localDayLengthMinutes(dayStart: Date, tz: string): number {
  return minutesBetween(dayStart, startOfNextLocalDay(dayStart, tz));
}

export function minutesFromLocalMidnight(instant: Date, tz: string): number {
  return minutesBetween(startOfLocalDay(instant, tz), instant);
}

/** Wall-clock minutes: 09:30 is always 570 even on a DST day with 8.5h elapsed. Grid uses this so the hour gutter stays honest; durations use elapsed minutes. */
export function wallClockMinutes(instant: Date, tz: string): number {
  const z = new TZDate(instant, tz);
  return z.getHours() * 60 + z.getMinutes();
}

/** Instant from a local calendar date plus minutes past midnight. */
export function instantFromLocalParts(
  dateKey: string,
  minutes: number,
  tz: string,
): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const zoned = new TZDate(
    year,
    month - 1,
    day,
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
    tz,
  );
  return new Date(zoned.getTime());
}

/** "2026-07-28" in the home zone. */
export function dayKey(instant: Date, tz: string): string {
  const z = new TZDate(instant, tz);
  return `${z.getFullYear()}-${pad(z.getMonth() + 1)}-${pad(z.getDate())}`;
}

/** Zone-free calendar arithmetic on a date key; a key names a calendar square, not an instant, so DST can't make the last Sunday in October ambiguous. */
export function shiftDateKey(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(
    shifted.getUTCDate(),
  )}`;
}

/** Whole calendar days from one date key to another. Negative if `to` is earlier. */
export function daysBetweenDateKeys(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

/** "2026-W31"; ISO week starts Monday. */
export function weekKey(instant: Date, tz: string): string {
  const z = new TZDate(instant, tz);
  return `${getISOWeekYear(z)}-W${pad(getISOWeek(z))}`;
}

/** 1-53. ISO week number on its own, for the header. */
export function isoWeekNumber(instant: Date, tz: string): number {
  return getISOWeek(new TZDate(instant, tz));
}

/** The ISO week-numbering year, which is not always the calendar year. */
export function isoWeekYear(instant: Date, tz: string): number {
  return getISOWeekYear(new TZDate(instant, tz));
}

/** The instant of Monday 00:00 for the week `instant` falls in. */
export function startOfLocalWeek(instant: Date, tz: string): Date {
  return new Date(startOfISOWeek(new TZDate(instant, tz)).getTime());
}

export function isWeekKey(value: string): boolean {
  return /^\d{4}-W\d{2}$/.test(value);
}

/** Inverse of `weekKey`: "2026-W31" -> instant of that Monday 00:00 local. */
export function weekStartFromKey(key: string, tz: string): Date {
  const [year, week] = key.split("-W").map(Number);
  // Jan 4th is always in ISO week 1, in every year, by definition.
  const jan4 = new TZDate(year, 0, 4, 0, 0, 0, 0, tz);
  return new Date(addWeeks(startOfISOWeek(jan4), week - 1).getTime());
}

/** The seven local midnights of the week containing `instant`. */
export function weekDays(instant: Date, tz: string): Date[] {
  const monday = startOfLocalWeek(instant, tz);
  const days: Date[] = [monday];
  for (let i = 1; i < 7; i++) {
    days.push(startOfNextLocalDay(days[i - 1], tz));
  }
  return days;
}

export function shiftWeeks(instant: Date, tz: string, delta: number): Date {
  return new Date(addWeeks(new TZDate(instant, tz), delta).getTime());
}

/** Shift an ISO string by a fixed number of milliseconds, returning an ISO string. */
export function shiftInstant(iso: string, ms: number): string {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

/** "09:12" in the home zone. */
export function formatClock(instant: Date, tz: string): string {
  const z = new TZDate(instant, tz);
  return `${pad(z.getHours())}:${pad(z.getMinutes())}`;
}

/** "2026-07-28" in the home zone. */
export function formatDateISO(instant: Date, tz: string): string {
  return dayKey(instant, tz);
}

/** Minutes from midnight rendered as a grid label: 540 -> "09:00". */
export function formatMinutesAsClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${pad(Math.floor(wrapped / 60))}:${pad(wrapped % 60)}`;
}

/** Same minute on a 12-hour clock: 540 -> "9:00 am", 0 -> "12:00 am". The dial uses am/pm buttons, so 12-hour suffices. */
export function formatMinutesAs12Hour(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${pad(wrapped % 60)} ${hours < 12 ? "am" : "pm"}`;
}

/** "HH:MM:SS", hours uncapped. The duration column format. */
export function formatDurationClock(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}:00`;
}

/** "8h 12m" / "45m" / "0m"; UI only, not export. */
export function formatDurationHuman(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/** "2:05:31"; the live running clock, the only place seconds are shown. */
export function formatElapsedWithSeconds(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

/** Decimal hours, 2dp; for charts and goal deltas. */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

/** Half-typed time field auto-inserts the colon: "0930" -> "09:30", "930" -> "9:30" (93 is not an hour). A typed colon stays put, so "9:" doesn't collapse to "9". */
export function maskClockInput(raw: string): string {
  const colon = raw.indexOf(":");
  if (colon >= 0) {
    const hours = raw.slice(0, colon).replace(/\D/g, "").slice(0, 2);
    const minutes = raw.slice(colon + 1).replace(/\D/g, "").slice(0, 2);
    return `${hours}:${minutes}`;
  }

  const digits = raw.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  if (digits.length === 3 && Number(digits.slice(0, 2)) > 23) {
    return `${digits.slice(0, 1)}:${digits.slice(1)}`;
  }
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

/** Parse "09:30" into 570. Returns null on anything malformed. */
export function parseClockToMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Weekday labels for the week header, in the home zone. */
export function formatWeekdayShort(instant: Date, tz: string, locale = "en-GB"): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: tz }).format(instant);
}

export function formatDayOfMonth(instant: Date, tz: string): number {
  return new TZDate(instant, tz).getDate();
}

/** "Jul-1", "Aug-12"; the UI's one calendar-date format. Unpadded day so it reads as a date, not code. */
export function formatDayLabel(instant: Date, tz: string, locale = "en-GB"): string {
  const month = new Intl.DateTimeFormat(locale, { month: "short", timeZone: tz }).format(
    instant,
  );
  return `${month}-${formatDayOfMonth(instant, tz)}`;
}

export function formatRangeLabel(start: Date, end: Date, tz: string, locale = "en-GB"): string {
  // `end` is the exclusive Monday of the next week; label the inclusive Sunday.
  return `${formatDayLabel(start, tz, locale)} – ${formatDayLabel(addMinutes(end, -1), tz, locale)}`;
}
