/**
 * CSV export column layout. See ARCHITECTURE.md §11.
 *
 * A multi-day entry exports as ONE row with different start and end dates —
 * splitting it would misrepresent the entry.
 */
import { formatClock, formatDateISO, formatDurationClock, minutesBetween } from "./time";

export const CSV_HEADER = [
  "Project",
  "Task",
  "Description",
  "Start date",
  "Start time",
  "End date",
  "End time",
  "Duration",
  "Tags",
] as const;

export interface ExportableEntry {
  description: string;
  projectName: string;
  taskName: string | null;
  startedAt: Date;
  endedAt: Date;
  tags: string[];
}

/** RFC 4180: quote when the value contains a comma, quote, or newline. */
export function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function entryToCsvRow(entry: ExportableEntry, tz: string): string[] {
  return [
    entry.projectName,
    entry.taskName ?? "",
    entry.description,
    formatDateISO(entry.startedAt, tz),
    formatClock(entry.startedAt, tz),
    formatDateISO(entry.endedAt, tz),
    formatClock(entry.endedAt, tz),
    formatDurationClock(minutesBetween(entry.startedAt, entry.endedAt)),
    entry.tags.join(", "),
  ];
}

export function toCsvLine(cells: readonly string[]): string {
  return cells.map(csvEscape).join(",");
}

export function toCsv(entries: ExportableEntry[], tz: string): string {
  return [
    toCsvLine(CSV_HEADER),
    ...entries.map((entry) => toCsvLine(entryToCsvRow(entry, tz))),
  ].join("\r\n");
}
