import { describe, expect, it } from "vitest";
import {
  assignLanes,
  blockFromClick,
  minutesOnDay,
  pixelsToMinutes,
  splitAcrossDays,
} from "./layout";
import { startOfLocalDay } from "./time";

const TZ = "Europe/Madrid";

describe("splitAcrossDays", () => {
  it("leaves a same-day entry as one segment", () => {
    const segments = splitAcrossDays(
      new Date("2026-07-28T07:00:00Z"), // 09:00 local
      new Date("2026-07-28T08:30:00Z"), // 10:30 local
      TZ,
    );
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({
      dayKey: "2026-07-28",
      startMinutes: 540,
      endMinutes: 630,
      continuesBefore: false,
      continuesAfter: false,
    });
  });

  it("splits an entry crossing local midnight", () => {
    const segments = splitAcrossDays(
      new Date("2026-07-28T20:00:00Z"), // 22:00 local Tue
      new Date("2026-07-29T00:00:00Z"), // 02:00 local Wed
      TZ,
    );
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      dayKey: "2026-07-28",
      startMinutes: 1320,
      endMinutes: 1440,
      continuesBefore: false,
      continuesAfter: true,
    });
    expect(segments[1]).toMatchObject({
      dayKey: "2026-07-29",
      startMinutes: 0,
      endMinutes: 120,
      continuesBefore: true,
      continuesAfter: false,
    });
  });

  it("handles an entry spanning three days", () => {
    const segments = splitAcrossDays(
      new Date("2026-07-27T20:00:00Z"),
      new Date("2026-07-30T06:00:00Z"),
      TZ,
    );
    expect(segments.map((s) => s.dayKey)).toEqual([
      "2026-07-27",
      "2026-07-28",
      "2026-07-29",
      "2026-07-30",
    ]);
    expect(segments[1].startMinutes).toBe(0);
    expect(segments[1].endMinutes).toBe(1440);
    expect(segments[1].continuesBefore).toBe(true);
    expect(segments[1].continuesAfter).toBe(true);
  });

  it("reports a 23-hour day across the spring-forward transition", () => {
    const segments = splitAcrossDays(
      new Date("2026-03-28T22:00:00Z"), // 23:00 local Sat
      new Date("2026-03-29T22:00:00Z"), // 00:00 local Mon
      TZ,
    );
    const sunday = segments.find((s) => s.dayKey === "2026-03-29");
    expect(sunday?.dayLengthMinutes).toBe(1380);
    expect(sunday?.endMinutes).toBe(1380);
  });

  it("returns nothing for a zero-length or inverted range", () => {
    const t = new Date("2026-07-28T09:00:00Z");
    expect(splitAcrossDays(t, t, TZ)).toEqual([]);
    expect(splitAcrossDays(t, new Date("2026-07-28T08:00:00Z"), TZ)).toEqual([]);
  });
});

describe("minutesOnDay", () => {
  it("attributes each day its real share of a multi-day entry", () => {
    const start = new Date("2026-07-28T20:00:00Z"); // 22:00 local Tue
    const end = new Date("2026-07-29T00:00:00Z"); // 02:00 local Wed
    const tuesday = startOfLocalDay(start, TZ);
    const wednesday = startOfLocalDay(end, TZ);

    expect(minutesOnDay(start, end, tuesday, TZ)).toBe(120);
    expect(minutesOnDay(start, end, wednesday, TZ)).toBe(120);
  });

  it("is zero for a day the entry does not touch", () => {
    const start = new Date("2026-07-28T07:00:00Z");
    const end = new Date("2026-07-28T08:00:00Z");
    const otherDay = startOfLocalDay(new Date("2026-07-30T10:00:00Z"), TZ);
    expect(minutesOnDay(start, end, otherDay, TZ)).toBe(0);
  });
});

describe("pixelsToMinutes", () => {
  it("snaps to the given increment", () => {
    expect(pixelsToMinutes(100, 1, 5, 1440)).toBe(100);
    expect(pixelsToMinutes(102, 1, 5, 1440)).toBe(100);
    expect(pixelsToMinutes(103, 1, 5, 1440)).toBe(105);
  });

  it("clamps to the day", () => {
    expect(pixelsToMinutes(-40, 1, 5, 1440)).toBe(0);
    expect(pixelsToMinutes(99_999, 1, 5, 1440)).toBe(1440);
  });
});

describe("assignLanes", () => {
  it("puts non-overlapping items all in lane 0", () => {
    const laned = assignLanes([
      { startMinutes: 0, endMinutes: 60 },
      { startMinutes: 60, endMinutes: 120 },
    ]);
    expect(laned.every((item) => item.lane === 0 && item.laneCount === 1)).toBe(true);
  });

  it("splits genuinely overlapping items into lanes", () => {
    const laned = assignLanes([
      { startMinutes: 0, endMinutes: 90 },
      { startMinutes: 30, endMinutes: 120 },
    ]);
    expect(laned.map((item) => item.lane).sort()).toEqual([0, 1]);
    expect(laned.every((item) => item.laneCount === 2)).toBe(true);
  });
});

describe("blockFromClick", () => {
  const DAY = 1440;

  it("creates the full default block on an empty day", () => {
    expect(blockFromClick(540, [], 30, DAY)).toEqual({ startMinutes: 540, endMinutes: 570 });
  });

  it("starts where the click landed, not at the current time", () => {
    expect(blockFromClick(870, [], 30, DAY)?.startMinutes).toBe(870);
  });

  it("stops short when the next entry is closer than the default length", () => {
    const occupied = [{ startMinutes: 550, endMinutes: 600 }];
    expect(blockFromClick(540, occupied, 30, DAY)).toEqual({
      startMinutes: 540,
      endMinutes: 550,
    });
  });

  it("ignores entries that start before the click", () => {
    const occupied = [{ startMinutes: 400, endMinutes: 480 }];
    expect(blockFromClick(540, occupied, 30, DAY)?.endMinutes).toBe(570);
  });

  it("clips to the end of the day rather than spilling past midnight", () => {
    expect(blockFromClick(1420, [], 30, DAY)).toEqual({
      startMinutes: 1420,
      endMinutes: DAY,
    });
  });

  it("returns null when the click is inside an existing entry", () => {
    const occupied = [{ startMinutes: 540, endMinutes: 600 }];
    expect(blockFromClick(560, occupied, 30, DAY)).toBeNull();
  });

  it("returns null when the gap is under a minute, rather than a rejected write", () => {
    const occupied = [{ startMinutes: 541, endMinutes: 600 }];
    expect(blockFromClick(540.5, occupied, 30, DAY)).toBeNull();
  });

  it("returns null at the very end of the day", () => {
    expect(blockFromClick(DAY, [], 30, DAY)).toBeNull();
  });

  it("never produces a block that overlaps an existing one", () => {
    const occupied = [
      { startMinutes: 540, endMinutes: 600 },
      { startMinutes: 615, endMinutes: 700 },
    ];
    for (let at = 0; at < DAY; at += 5) {
      const block = blockFromClick(at, occupied, 30, DAY);
      if (!block) continue;
      for (const slot of occupied) {
        expect(block.startMinutes < slot.endMinutes && slot.startMinutes < block.endMinutes).toBe(
          false,
        );
      }
    }
  });
});
