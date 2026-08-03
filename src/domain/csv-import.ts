/**
 * CSV export → Cadence entries. The inverse of `csv.ts`.
 *
 * The source format is a superset of ours in one direction and a subset in the
 * other. Two mismatches have to be resolved here rather than at the database,
 * because the database answers them with a constraint violation and no context:
 *
 *   - The source permits overlapping entries; we forbid them (`no_overlapping_entries`).
 *   - The source keeps seconds; we round to the minute and enforce a one-minute floor.
 *
 * Everything in this module is pure so the resolution can be dry-run and
 * reported before anything is written. See ARCHITECTURE.md §4 and §11.
 */
import { TZDate } from "@date-fns/tz";
import { MIN_ENTRY_MINUTES } from "./overlap";
import { minutesBetween, roundToMinute } from "./time";

// ---------------------------------------------------------------------------
// CSV parsing (RFC 4180)
// ---------------------------------------------------------------------------

/**
 * Field-level parser. Any description containing a comma is quoted, and
 * descriptions containing newlines do occur, so this cannot be a line split.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  // A BOM survives Excel round-trips and would corrupt the first header name.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  for (; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\r") {
      // swallow; the \n that follows ends the record
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

/**
 * Header-keyed records. Column *order* differs between sources and our own
 * export is a strict subset, so nothing may be positional.
 */
export function toRecords(rows: string[][]): Record<string, string>[] {
  if (rows.length === 0) return [];
  const header = rows[0].map((name) => name.trim().toLowerCase());
  return rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    header.forEach((name, index) => {
      record[name] = (cells[index] ?? "").trim();
    });
    return record;
  });
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const SLASH_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const CLOCK = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;

export type DateOrder = "iso" | "dmy" | "mdy";

/**
 * A source file may write `YYYY-MM-DD` or a locale slash format, and
 * `03/04/2026` is a different day depending on which. Guessing silently would
 * misfile up to eleven months of history, so an ambiguous file is an error the
 * caller has to resolve with an explicit order.
 */
export function detectDateOrder(values: string[]): DateOrder | "ambiguous" {
  let sawSlash = false;
  for (const value of values) {
    if (ISO_DATE.test(value)) continue;
    const match = SLASH_DATE.exec(value);
    if (!match) continue;
    sawSlash = true;
    const first = Number(match[1]);
    const second = Number(match[2]);
    if (first > 12) return "dmy";
    if (second > 12) return "mdy";
  }
  return sawSlash ? "ambiguous" : "iso";
}

/**
 * Wall-clock date + time in `tz` → the UTC instant. The CSV carries no
 * offset, so the zone is supplied by the caller and is the single biggest way
 * an import can land hours off.
 */
export function parseWallClock(
  date: string,
  time: string,
  tz: string,
  order: DateOrder,
): Date | null {
  let year: number;
  let month: number;
  let day: number;

  const iso = ISO_DATE.exec(date);
  if (iso) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else {
    const slash = SLASH_DATE.exec(date);
    if (!slash) return null;
    year = Number(slash[3]);
    if (order === "mdy") {
      month = Number(slash[1]);
      day = Number(slash[2]);
    } else {
      day = Number(slash[1]);
      month = Number(slash[2]);
    }
  }

  const clock = CLOCK.exec(time);
  if (!clock) return null;
  const hours = Number(clock[1]);
  const minutes = Number(clock[2]);
  const seconds = clock[3] ? Number(clock[3]) : 0;

  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hours > 23 || minutes > 59 || seconds > 59) return null;

  const instant = new Date(
    new TZDate(year, month - 1, day, hours, minutes, seconds, 0, tz).getTime(),
  );
  if (Number.isNaN(instant.getTime())) return null;

  // A wall-clock time inside a spring-forward gap does not exist; TZDate maps it
  // forward rather than failing, which is the behaviour we want but worth naming.
  return instant;
}

// ---------------------------------------------------------------------------
// Mapping
// ---------------------------------------------------------------------------

export interface ImportCandidate {
  /** 1-based row number in the source file, for error reports. */
  line: number;
  description: string;
  projectName: string | null;
  taskName: string | null;
  tags: string[];
  startedAt: Date;
  endedAt: Date;
}

export interface RejectedRow {
  line: number;
  reason: "unparseable-dates" | "end-before-start" | "sub-minute";
  detail: string;
}

export interface MapResult {
  candidates: ImportCandidate[];
  rejected: RejectedRow[];
  /** True when the file had no recognisable columns at all. */
  missingColumns: string[];
}

const REQUIRED = ["start date", "start time", "end date", "end time"];

export function mapRecords(
  records: Record<string, string>[],
  tz: string,
  order: DateOrder,
): MapResult {
  const candidates: ImportCandidate[] = [];
  const rejected: RejectedRow[] = [];

  if (records.length === 0) return { candidates, rejected, missingColumns: REQUIRED };

  const present = Object.keys(records[0]);
  const missingColumns = REQUIRED.filter((name) => !present.includes(name));
  if (missingColumns.length > 0) return { candidates, rejected, missingColumns };

  records.forEach((record, index) => {
    const line = index + 2; // +1 for the header, +1 for 1-based counting
    const startedRaw = parseWallClock(
      record["start date"],
      record["start time"],
      tz,
      order,
    );
    const endedRaw = parseWallClock(record["end date"], record["end time"], tz, order);

    if (!startedRaw || !endedRaw) {
      rejected.push({
        line,
        reason: "unparseable-dates",
        detail: `${record["start date"]} ${record["start time"]} → ${record["end date"]} ${record["end time"]}`,
      });
      return;
    }

    const startedAt = roundToMinute(startedRaw);
    const endedAt = roundToMinute(endedRaw);
    const label = record["description"] || record["project"] || "(no description)";

    if (endedAt < startedAt) {
      rejected.push({ line, reason: "end-before-start", detail: label });
      return;
    }

    // Rounding is monotonic, so it cannot turn a clean file into a crossing
    // overlap — but anything under ~30 seconds collapses to zero length, which
    // the `end_after_start` check would reject.
    if (minutesBetween(startedAt, endedAt) < MIN_ENTRY_MINUTES) {
      rejected.push({ line, reason: "sub-minute", detail: label });
      return;
    }

    candidates.push({
      line,
      description: record["description"] ?? "",
      projectName: record["project"] || null,
      taskName: record["task"] || null,
      tags: (record["tags"] ?? "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      startedAt,
      endedAt,
    });
  });

  return { candidates, rejected, missingColumns: [] };
}

// ---------------------------------------------------------------------------
// Overlap resolution
// ---------------------------------------------------------------------------

export type ConflictPolicy = "skip" | "truncate";

export interface Conflict {
  line: number;
  /** The row it collided with. */
  againstLine: number;
  action: "skipped" | "truncated-previous" | "dropped-previous";
  lostMinutes: number;
}

export interface ResolveResult {
  entries: ImportCandidate[];
  conflicts: Conflict[];
}

/**
 * Produces a strictly non-overlapping, ascending list.
 *
 * `skip` drops the later row. `truncate` shortens the *earlier* row to end where
 * the later one begins, which is the right shape for the common case: a timer
 * left running overnight across days that were also logged deliberately. An
 * earlier row truncated below the one-minute floor is dropped instead.
 */
export function resolveOverlaps(
  candidates: ImportCandidate[],
  policy: ConflictPolicy,
): ResolveResult {
  const sorted = [...candidates].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime() || a.line - b.line,
  );

  const entries: ImportCandidate[] = [];
  const conflicts: Conflict[] = [];

  for (const candidate of sorted) {
    const previous = entries[entries.length - 1];

    if (!previous || candidate.startedAt >= previous.endedAt) {
      entries.push({ ...candidate });
      continue;
    }

    if (policy === "skip") {
      conflicts.push({
        line: candidate.line,
        againstLine: previous.line,
        action: "skipped",
        lostMinutes: minutesBetween(candidate.startedAt, candidate.endedAt),
      });
      continue;
    }

    const lost = minutesBetween(candidate.startedAt, previous.endedAt);

    if (minutesBetween(previous.startedAt, candidate.startedAt) < MIN_ENTRY_MINUTES) {
      // Shortening would leave a sub-minute stub; the later row wins outright.
      entries.pop();
      conflicts.push({
        line: candidate.line,
        againstLine: previous.line,
        action: "dropped-previous",
        lostMinutes: minutesBetween(previous.startedAt, previous.endedAt),
      });
      const carried = entries[entries.length - 1];
      if (carried && candidate.startedAt < carried.endedAt) {
        // The dropped row was hiding a second collision underneath it.
        carried.endedAt = candidate.startedAt;
      }
      entries.push({ ...candidate });
      continue;
    }

    previous.endedAt = candidate.startedAt;
    conflicts.push({
      line: candidate.line,
      againstLine: previous.line,
      action: "truncated-previous",
      lostMinutes: lost,
    });
    entries.push({ ...candidate });
  }

  return { entries, conflicts };
}

/** Total tracked minutes, for the before/after figure in the dry-run report. */
export function totalMinutes(entries: { startedAt: Date; endedAt: Date }[]): number {
  return entries.reduce(
    (sum, entry) => sum + minutesBetween(entry.startedAt, entry.endedAt),
    0,
  );
}
