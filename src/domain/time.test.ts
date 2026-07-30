import { describe, expect, it } from "vitest";
import {
  daysBetweenDateKeys,
  formatDayLabel,
  formatDurationClock,
  formatDurationHuman,
  formatMinutesAsClock,
  formatRangeLabel,
  isoWeekNumber,
  isoWeekYear,
  localDayLengthMinutes,
  maskClockInput,
  minutesFromLocalMidnight,
  parseClockToMinutes,
  roundToMinute,
  shiftDateKey,
  startOfLocalDay,
  weekDays,
  weekKey,
  weekStartFromKey,
} from "./time";

const TZ = "Europe/Madrid";

describe("roundToMinute", () => {
  it("rounds down below 30s", () => {
    expect(roundToMinute(new Date("2026-07-28T09:12:29.000Z")).toISOString()).toBe(
      "2026-07-28T09:12:00.000Z",
    );
  });

  it("rounds up from 30s", () => {
    expect(roundToMinute(new Date("2026-07-28T09:12:30.000Z")).toISOString()).toBe(
      "2026-07-28T09:13:00.000Z",
    );
  });

  it("leaves an exact minute alone", () => {
    expect(roundToMinute(new Date("2026-07-28T09:12:00.000Z")).toISOString()).toBe(
      "2026-07-28T09:12:00.000Z",
    );
  });
});

describe("local day boundaries", () => {
  it("finds local midnight in the home zone, not UTC", () => {
    // 00:30 local on the 28th is 22:30 UTC on the 27th (CEST = UTC+2).
    const instant = new Date("2026-07-27T22:30:00.000Z");
    expect(startOfLocalDay(instant, TZ).toISOString()).toBe("2026-07-27T22:00:00.000Z");
    expect(minutesFromLocalMidnight(instant, TZ)).toBe(30);
  });

  it("is 1440 minutes on an ordinary day", () => {
    expect(localDayLengthMinutes(startOfLocalDay(new Date("2026-07-28T10:00:00Z"), TZ), TZ)).toBe(
      1440,
    );
  });

  it("is 23 hours on the spring-forward day", () => {
    const day = startOfLocalDay(new Date("2026-03-29T12:00:00Z"), TZ);
    expect(localDayLengthMinutes(day, TZ)).toBe(1380);
  });

  it("is 25 hours on the fall-back day", () => {
    const day = startOfLocalDay(new Date("2026-10-25T12:00:00Z"), TZ);
    expect(localDayLengthMinutes(day, TZ)).toBe(1500);
  });
});

describe("date key arithmetic", () => {
  it("shifts a day forward and back", () => {
    expect(shiftDateKey("2026-07-28", 1)).toBe("2026-07-29");
    expect(shiftDateKey("2026-07-28", -1)).toBe("2026-07-27");
    expect(shiftDateKey("2026-07-28", 0)).toBe("2026-07-28");
  });

  it("rolls over month and year ends", () => {
    expect(shiftDateKey("2026-07-31", 1)).toBe("2026-08-01");
    expect(shiftDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftDateKey("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("shifts across a DST boundary without losing a day", () => {
    // Both transitions in the home zone. A key names a calendar square, so a
    // 23- or 25-hour day must still be exactly one step.
    expect(shiftDateKey("2026-03-29", 1)).toBe("2026-03-30");
    expect(shiftDateKey("2026-10-25", 1)).toBe("2026-10-26");
  });

  it("counts whole days between keys", () => {
    expect(daysBetweenDateKeys("2026-07-28", "2026-07-29")).toBe(1);
    expect(daysBetweenDateKeys("2026-07-28", "2026-07-28")).toBe(0);
    expect(daysBetweenDateKeys("2026-07-29", "2026-07-28")).toBe(-1);
    expect(daysBetweenDateKeys("2026-10-24", "2026-10-27")).toBe(3);
    expect(daysBetweenDateKeys("2026-12-30", "2027-01-02")).toBe(3);
  });

  it("round-trips against shiftDateKey", () => {
    const from = "2026-10-25";
    for (const days of [0, 1, 2, 7, 40, 365]) {
      expect(daysBetweenDateKeys(from, shiftDateKey(from, days))).toBe(days);
    }
  });
});

describe("ISO weeks", () => {
  it("derives the week key in the home zone", () => {
    expect(weekKey(new Date("2026-07-28T10:00:00Z"), TZ)).toBe("2026-W31");
  });

  it("round-trips a week key to that Monday's local midnight", () => {
    // Monday 27 July 2026, 00:00 CEST == Sunday 22:00 UTC.
    expect(weekStartFromKey("2026-W31", TZ).toISOString()).toBe("2026-07-26T22:00:00.000Z");
  });

  it("returns seven consecutive local midnights", () => {
    const days = weekDays(new Date("2026-07-28T10:00:00Z"), TZ);
    expect(days).toHaveLength(7);
    expect(days[0].toISOString()).toBe("2026-07-26T22:00:00.000Z");
    expect(days[6].toISOString()).toBe("2026-08-01T22:00:00.000Z");
  });

  it("keeps seven days across the fall-back week", () => {
    const days = weekDays(new Date("2026-10-21T10:00:00Z"), TZ);
    expect(days).toHaveLength(7);
    // Local midnight stays local midnight even though one day is 25h long.
    for (const day of days) {
      expect(minutesFromLocalMidnight(day, TZ)).toBe(0);
    }
  });
});

describe("formatting", () => {
  it("formats grid labels", () => {
    expect(formatMinutesAsClock(540)).toBe("09:00");
    expect(formatMinutesAsClock(0)).toBe("00:00");
    expect(formatMinutesAsClock(1439)).toBe("23:59");
  });

  it("formats durations as uncapped HH:MM:SS for export", () => {
    expect(formatDurationClock(36)).toBe("00:36:00");
    expect(formatDurationClock(90)).toBe("01:30:00");
    expect(formatDurationClock(36 * 60)).toBe("36:00:00");
  });

  it("formats durations for humans", () => {
    expect(formatDurationHuman(0)).toBe("0m");
    expect(formatDurationHuman(45)).toBe("45m");
    expect(formatDurationHuman(60)).toBe("1h");
    expect(formatDurationHuman(492)).toBe("8h 12m");
  });

  it("parses clock input and rejects nonsense", () => {
    expect(parseClockToMinutes("09:30")).toBe(570);
    expect(parseClockToMinutes("9:30")).toBe(570);
    expect(parseClockToMinutes("24:00")).toBeNull();
    expect(parseClockToMinutes("09:60")).toBeNull();
    expect(parseClockToMinutes("hello")).toBeNull();
  });
});

describe("maskClockInput", () => {
  it("puts the colon in for you", () => {
    expect(maskClockInput("0930")).toBe("09:30");
    expect(maskClockInput("093")).toBe("09:3");
    expect(maskClockInput("1")).toBe("1");
    expect(maskClockInput("14")).toBe("14");
  });

  it("reads a three-digit time as h:mm when hh would be past 23", () => {
    expect(maskClockInput("930")).toBe("9:30");
    expect(maskClockInput("245")).toBe("2:45");
    // 09 and 23 are real hours, so the first two digits stay the hour.
    expect(maskClockInput("091")).toBe("09:1");
    expect(maskClockInput("235")).toBe("23:5");
  });

  it("leaves a colon you typed where you put it", () => {
    expect(maskClockInput("9:")).toBe("9:");
    expect(maskClockInput("9:3")).toBe("9:3");
    expect(maskClockInput("9:30")).toBe("9:30");
    expect(maskClockInput("09:30")).toBe("09:30");
  });

  it("drops everything that is not a digit", () => {
    expect(maskClockInput("9am")).toBe("9");
    expect(maskClockInput("09.30")).toBe("09:30");
    expect(maskClockInput("")).toBe("");
  });

  it("stops at four digits", () => {
    expect(maskClockInput("093012")).toBe("09:30");
    expect(maskClockInput("09:3012")).toBe("09:30");
  });

  it("shortens cleanly as you backspace through it", () => {
    expect(maskClockInput("09:3")).toBe("09:3");
    expect(maskClockInput("09:")).toBe("09:");
    expect(maskClockInput("09")).toBe("09");
    expect(maskClockInput("0")).toBe("0");
  });

  it("hands parseClockToMinutes something it can read", () => {
    for (const typed of ["0930", "930", "9:30"]) {
      expect(parseClockToMinutes(maskClockInput(typed))).toBe(570);
    }
  });
});

describe("date and range labels", () => {
  it("formats a date as Mmm-D, unpadded", () => {
    expect(formatDayLabel(new Date("2026-07-01T10:00:00Z"), TZ)).toBe("Jul-1");
    expect(formatDayLabel(new Date("2026-08-12T10:00:00Z"), TZ)).toBe("Aug-12");
  });

  it("formats a date in the home zone, not the browser's", () => {
    // 09:00 Tokyo on the 1st is still 00:00 UTC, but the previous day in Madrid.
    const instant = new Date("2026-08-01T00:00:00Z");
    expect(formatDayLabel(instant, "Asia/Tokyo")).toBe("Aug-1");
    expect(formatDayLabel(instant, TZ)).toBe("Aug-1");
    expect(formatDayLabel(instant, "America/New_York")).toBe("Jul-31");
  });

  it("labels a week from its Monday to its inclusive Sunday", () => {
    const start = weekStartFromKey("2026-W31", TZ);
    const end = weekStartFromKey("2026-W32", TZ);
    expect(formatRangeLabel(start, end, TZ)).toBe("Jul-27 – Aug-2");
  });
});

describe("ISO week header", () => {
  it("gives the week number on its own", () => {
    expect(isoWeekNumber(new Date("2026-07-28T10:00:00Z"), TZ)).toBe(31);
    expect(isoWeekNumber(new Date("2026-01-01T10:00:00Z"), TZ)).toBe(1);
  });

  it("uses the ISO week-numbering year, which straddles January", () => {
    // 1 Jan 2027 is a Friday, so it falls in the last ISO week of 2026.
    const instant = new Date("2027-01-01T10:00:00Z");
    expect(isoWeekNumber(instant, TZ)).toBe(53);
    expect(isoWeekYear(instant, TZ)).toBe(2026);
  });
});
