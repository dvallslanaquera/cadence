import { describe, expect, it } from "vitest";
import { csvEscape, entryToCsvRow, toCsv } from "./csv";

const TZ = "Europe/Madrid";

describe("csvEscape", () => {
  it("leaves plain values alone", () => {
    expect(csvEscape("Email triage")).toBe("Email triage");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvEscape("admin, billing")).toBe('"admin, billing"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("two\nlines")).toBe('"two\nlines"');
  });
});

describe("entryToCsvRow", () => {
  it("renders wall-clock times in the home zone", () => {
    const row = entryToCsvRow(
      {
        description: "Email triage",
        projectName: "Others",
        taskName: null,
        startedAt: new Date("2026-07-27T07:12:00Z"), // 09:12 CEST
        endedAt: new Date("2026-07-27T07:48:00Z"), // 09:48 CEST
        tags: ["admin"],
      },
      TZ,
    );
    expect(row).toEqual([
      "Others",
      "",
      "Email triage",
      "2026-07-27",
      "09:12",
      "2026-07-27",
      "09:48",
      "00:36:00",
      "admin",
    ]);
  });

  it("exports a multi-day entry as one row with different dates", () => {
    const row = entryToCsvRow(
      {
        description: "Overnight render",
        projectName: "Client work",
        taskName: "Batch export",
        startedAt: new Date("2026-07-28T20:00:00Z"), // 22:00 local Tue
        endedAt: new Date("2026-07-29T04:00:00Z"), // 06:00 local Wed
        tags: [],
      },
      TZ,
    );
    expect(row[3]).toBe("2026-07-28");
    expect(row[5]).toBe("2026-07-29");
    expect(row[7]).toBe("08:00:00");
  });
});

describe("toCsv", () => {
  it("emits the CSV header and quotes multi-tag cells", () => {
    const csv = toCsv(
      [
        {
          description: "Sprint planning",
          projectName: "Cadence",
          taskName: null,
          startedAt: new Date("2026-07-27T07:00:00Z"),
          endedAt: new Date("2026-07-27T08:00:00Z"),
          tags: ["admin", "meetings"],
        },
      ],
      TZ,
    );
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(
      "Project,Task,Description,Start date,Start time,End date,End time,Duration,Tags",
    );
    expect(lines[1]).toContain('"admin, meetings"');
  });
});
