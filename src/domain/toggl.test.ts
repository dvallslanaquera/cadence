import { describe, expect, it } from "vitest";
import {
  detectDateOrder,
  mapRecords,
  parseCsv,
  parseWallClock,
  resolveOverlaps,
  toRecords,
  totalMinutes,
  type TogglCandidate,
} from "./toggl";

const TZ = "Asia/Tokyo";

describe("parseCsv", () => {
  it("keeps a quoted comma inside one field", () => {
    const rows = parseCsv('a,b\n"one, two",three\n');
    expect(rows[1]).toEqual(["one, two", "three"]);
  });

  it("unescapes doubled quotes", () => {
    const rows = parseCsv('a\n"He said ""hi"""\n');
    expect(rows[1]).toEqual(['He said "hi"']);
  });

  it("keeps a newline inside a quoted description", () => {
    const rows = parseCsv('a,b\n"line one\nline two",x\n');
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe("line one\nline two");
  });

  it("strips a BOM so the first header name is not corrupted", () => {
    const rows = parseCsv("﻿Project,Task\nAlpha,Beta\n");
    expect(rows[0][0]).toBe("Project");
  });

  it("handles CRLF, which is what Toggl actually emits", () => {
    const rows = parseCsv("a,b\r\n1,2\r\n");
    expect(rows[1]).toEqual(["1", "2"]);
  });
});

describe("toRecords", () => {
  it("keys by lowercased header, so column order never matters", () => {
    const records = toRecords(parseCsv("Project,Description\nAlpha,Writing\n"));
    expect(records[0]).toEqual({ project: "Alpha", description: "Writing" });
  });

  it("tolerates Toggl's extra columns", () => {
    const records = toRecords(
      parseCsv("User,Email,Project,Billable,Amount\nD,d@x.com,Alpha,Yes,10\n"),
    );
    expect(records[0].project).toBe("Alpha");
  });
});

describe("detectDateOrder", () => {
  it("reports iso when every date is unambiguous", () => {
    expect(detectDateOrder(["2026-07-28", "2026-01-02"])).toBe("iso");
  });

  it("infers dmy from a day above twelve", () => {
    expect(detectDateOrder(["13/04/2026", "03/04/2026"])).toBe("dmy");
  });

  it("infers mdy from a month-position value above twelve", () => {
    expect(detectDateOrder(["04/13/2026"])).toBe("mdy");
  });

  it("refuses to guess when every slash date could be read either way", () => {
    expect(detectDateOrder(["03/04/2026", "05/06/2026"])).toBe("ambiguous");
  });
});

describe("parseWallClock", () => {
  it("reads wall-clock time in the given zone, not the machine's", () => {
    // 09:00 in Tokyo is 00:00 UTC.
    expect(parseWallClock("2026-07-28", "09:00:00", TZ, "iso")?.toISOString()).toBe(
      "2026-07-28T00:00:00.000Z",
    );
  });

  it("applies the correct offset across a DST boundary", () => {
    // Madrid is +02:00 in July, +01:00 in January.
    const summer = parseWallClock("2026-07-28", "12:00:00", "Europe/Madrid", "iso");
    const winter = parseWallClock("2026-01-28", "12:00:00", "Europe/Madrid", "iso");
    expect(summer?.toISOString()).toBe("2026-07-28T10:00:00.000Z");
    expect(winter?.toISOString()).toBe("2026-01-28T11:00:00.000Z");
  });

  it("accepts a clock without seconds", () => {
    expect(parseWallClock("2026-07-28", "09:30", TZ, "iso")).not.toBeNull();
  });

  it("returns null rather than an Invalid Date", () => {
    expect(parseWallClock("not-a-date", "09:00:00", TZ, "iso")).toBeNull();
    expect(parseWallClock("2026-07-28", "25:00:00", TZ, "iso")).toBeNull();
  });
});

const header =
  "Project,Task,Description,Start date,Start time,End date,End time,Duration,Tags";

const row = (
  project: string,
  description: string,
  startDate: string,
  startTime: string,
  endDate: string,
  endTime: string,
  tags = "",
) =>
  // Toggl quotes the tag field when it holds more than one tag.
  `${project},,${description},${startDate},${startTime},${endDate},${endTime},00:00:00,"${tags}"`;

const mapCsv = (...rows: string[]) =>
  mapRecords(toRecords(parseCsv([header, ...rows].join("\r\n") + "\r\n")), TZ, "iso");

describe("mapRecords", () => {
  it("maps a well-formed row", () => {
    const { candidates } = mapCsv(
      row("Alpha", "Writing", "2026-07-28", "09:00:00", "2026-07-28", "10:30:00", "deep, focus"),
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].projectName).toBe("Alpha");
    expect(candidates[0].description).toBe("Writing");
    expect(candidates[0].tags).toEqual(["deep", "focus"]);
    expect(candidates[0].startedAt.toISOString()).toBe("2026-07-28T00:00:00.000Z");
  });

  it("reports the required columns when handed an unrelated file", () => {
    const result = mapRecords(toRecords(parseCsv("foo,bar\n1,2\n")), TZ, "iso");
    expect(result.missingColumns).toContain("start date");
  });

  it("rejects an entry that rounds away to zero length", () => {
    const result = mapCsv(
      row("Alpha", "Mis-tap", "2026-07-28", "09:00:05", "2026-07-28", "09:00:20"),
    );
    expect(result.candidates).toHaveLength(0);
    expect(result.rejected[0].reason).toBe("sub-minute");
  });

  it("keeps a short entry that survives rounding", () => {
    const result = mapCsv(
      row("Alpha", "Quick", "2026-07-28", "09:00:10", "2026-07-28", "09:00:50"),
    );
    expect(result.candidates).toHaveLength(1);
  });

  it("carries a multi-day entry through as one entry", () => {
    const { candidates } = mapCsv(
      row("Alpha", "Overnight", "2026-07-28", "22:00:00", "2026-07-29", "02:00:00"),
    );
    expect(candidates).toHaveLength(1);
    expect(candidates[0].endedAt.toISOString()).toBe("2026-07-28T17:00:00.000Z");
  });

  it("leaves the project null when Toggl exported no project", () => {
    const { candidates } = mapCsv(
      row("", "Unfiled", "2026-07-28", "09:00:00", "2026-07-28", "10:00:00"),
    );
    expect(candidates[0].projectName).toBeNull();
  });
});

const candidate = (line: number, start: string, end: string): TogglCandidate => ({
  line,
  description: `row ${line}`,
  projectName: "Alpha",
  taskName: null,
  tags: [],
  startedAt: new Date(start),
  endedAt: new Date(end),
});

describe("resolveOverlaps", () => {
  it("leaves a clean file untouched", () => {
    const input = [
      candidate(2, "2026-07-28T09:00:00Z", "2026-07-28T10:00:00Z"),
      candidate(3, "2026-07-28T10:00:00Z", "2026-07-28T11:00:00Z"),
    ];
    const { entries, conflicts } = resolveOverlaps(input, "skip");
    expect(conflicts).toEqual([]);
    expect(entries).toHaveLength(2);
  });

  it("skip drops the later row and keeps the earlier one whole", () => {
    const input = [
      candidate(2, "2026-07-28T09:00:00Z", "2026-07-28T17:00:00Z"),
      candidate(3, "2026-07-28T10:00:00Z", "2026-07-28T11:00:00Z"),
    ];
    const { entries, conflicts } = resolveOverlaps(input, "skip");
    expect(entries).toHaveLength(1);
    expect(entries[0].line).toBe(2);
    expect(conflicts[0].action).toBe("skipped");
    expect(conflicts[0].lostMinutes).toBe(60);
  });

  it("truncate shortens the forgotten timer to where the real entry starts", () => {
    const input = [
      candidate(2, "2026-07-28T09:00:00Z", "2026-07-28T17:00:00Z"),
      candidate(3, "2026-07-28T10:00:00Z", "2026-07-28T11:00:00Z"),
    ];
    const { entries, conflicts } = resolveOverlaps(input, "truncate");
    expect(entries).toHaveLength(2);
    expect(entries[0].endedAt.toISOString()).toBe("2026-07-28T10:00:00.000Z");
    expect(conflicts[0].action).toBe("truncated-previous");
    expect(conflicts[0].lostMinutes).toBe(420);
  });

  it("drops an earlier row that truncation would leave sub-minute", () => {
    const input = [
      candidate(2, "2026-07-28T09:00:00Z", "2026-07-28T17:00:00Z"),
      candidate(3, "2026-07-28T09:00:00Z", "2026-07-28T10:00:00Z"),
    ];
    const { entries, conflicts } = resolveOverlaps(input, "truncate");
    expect(entries).toHaveLength(1);
    expect(entries[0].line).toBe(3);
    expect(conflicts[0].action).toBe("dropped-previous");
  });

  it("never emits an overlapping pair, whatever the policy", () => {
    const input = [
      candidate(2, "2026-07-28T09:00:00Z", "2026-07-28T17:00:00Z"),
      candidate(3, "2026-07-28T10:00:00Z", "2026-07-28T11:00:00Z"),
      candidate(4, "2026-07-28T10:30:00Z", "2026-07-28T12:00:00Z"),
      candidate(5, "2026-07-28T11:00:00Z", "2026-07-28T11:30:00Z"),
    ];
    for (const policy of ["skip", "truncate"] as const) {
      const { entries } = resolveOverlaps(input, policy);
      for (let i = 1; i < entries.length; i++) {
        expect(entries[i].startedAt.getTime()).toBeGreaterThanOrEqual(
          entries[i - 1].endedAt.getTime(),
        );
        expect(entries[i - 1].endedAt.getTime()).toBeGreaterThan(
          entries[i - 1].startedAt.getTime(),
        );
      }
    }
  });

  it("sorts an out-of-order file before resolving", () => {
    const input = [
      candidate(2, "2026-07-28T14:00:00Z", "2026-07-28T15:00:00Z"),
      candidate(3, "2026-07-28T09:00:00Z", "2026-07-28T10:00:00Z"),
    ];
    const { entries } = resolveOverlaps(input, "skip");
    expect(entries.map((entry) => entry.line)).toEqual([3, 2]);
  });
});

describe("totalMinutes", () => {
  it("sums tracked time so the report can show what resolution cost", () => {
    expect(
      totalMinutes([
        candidate(2, "2026-07-28T09:00:00Z", "2026-07-28T10:00:00Z"),
        candidate(3, "2026-07-28T10:00:00Z", "2026-07-28T10:30:00Z"),
      ]),
    ).toBe(90);
  });
});
