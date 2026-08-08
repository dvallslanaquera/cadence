import { describe, expect, it } from "vitest";
import { GRID_MINUTES, dayTotalMinutes, segmentsByDay } from "./geometry";
import type { Entry } from "@/lib/types";

const TZ = "Europe/Madrid";

function entry(startedAt: string, endedAt: string | null, id = "e1"): Entry {
  return {
    id,
    startedAt,
    endedAt,
    description: "",
    project: { id: "p1", name: "Cadence", color: "#2a78d6" },
    task: null,
  } as unknown as Entry;
}

describe("segmentsByDay", () => {
  it("places a normal entry at its wall-clock minutes", () => {
    const segments = segmentsByDay(
      [entry("2026-07-28T07:00:00Z", "2026-07-28T08:30:00Z")],
      TZ,
      new Date("2026-07-28T10:00:00Z"),
    );
    expect(segments.get("2026-07-28")?.[0]).toMatchObject({
      topMinutes: 540,
      bottomMinutes: 630,
      running: false,
    });
  });

  it("keeps a just-started timer short instead of stretching it to midnight", () => {
    // Started 20 seconds ago: start and now land in the same wall-clock minute.
    const segments = segmentsByDay(
      [entry("2026-07-28T07:00:10Z", null)],
      TZ,
      new Date("2026-07-28T07:00:30Z"),
    );
    const segment = segments.get("2026-07-28")?.[0];
    expect(segment).toMatchObject({ topMinutes: 540, bottomMinutes: 540, running: true });
  });

  it("grows a running timer as it runs", () => {
    const segments = segmentsByDay(
      [entry("2026-07-28T07:00:00Z", null)],
      TZ,
      new Date("2026-07-28T07:40:00Z"),
    );
    expect(segments.get("2026-07-28")?.[0]).toMatchObject({
      topMinutes: 540,
      bottomMinutes: 580,
    });
  });

  it("draws an entry ending exactly at midnight down to the bottom of the day", () => {
    const segments = segmentsByDay(
      [entry("2026-07-28T20:00:00Z", "2026-07-28T22:00:00Z")], // 22:00 -> 00:00 local
      TZ,
      new Date("2026-07-29T10:00:00Z"),
    );
    const day = segments.get("2026-07-28");
    expect(day).toHaveLength(1);
    expect(day?.[0]).toMatchObject({ topMinutes: 1320, bottomMinutes: GRID_MINUTES });
    expect(segments.get("2026-07-29")).toBeUndefined();
  });

  it("splits across midnight and pins the first piece to the bottom", () => {
    const segments = segmentsByDay(
      [entry("2026-07-28T20:00:00Z", "2026-07-29T00:00:00Z")], // 22:00 -> 02:00 local
      TZ,
      new Date("2026-07-29T10:00:00Z"),
    );
    expect(segments.get("2026-07-28")?.[0]).toMatchObject({
      topMinutes: 1320,
      bottomMinutes: GRID_MINUTES,
      continuesAfter: true,
    });
    expect(segments.get("2026-07-29")?.[0]).toMatchObject({
      topMinutes: 0,
      bottomMinutes: 120,
      continuesBefore: true,
    });
  });

  it("counts real elapsed minutes, not the drawn height", () => {
    const segments = segmentsByDay(
      [entry("2026-07-28T07:00:10Z", null)],
      TZ,
      new Date("2026-07-28T07:00:30Z"),
    );
    expect(dayTotalMinutes(segments.get("2026-07-28"))).toBe(0);
  });
});
