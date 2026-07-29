import { describe, expect, it } from "vitest";
import { isHeartbeatStale, shouldAlert } from "./alerts";

const start = new Date("2026-07-28T09:00:00Z");
const after = (hours: number, minutes = 0) =>
  new Date(start.getTime() + hours * 3_600_000 + minutes * 60_000);

describe("shouldAlert", () => {
  const running = { startedAt: start, endedAt: null, alertSentAt: null };

  it("does not fire at 11h59", () => {
    expect(shouldAlert(running, after(11, 59), 12)).toBe(false);
  });

  it("fires at exactly the threshold", () => {
    expect(shouldAlert(running, after(12), 12)).toBe(true);
  });

  it("fires past the threshold", () => {
    expect(shouldAlert(running, after(12, 1), 12)).toBe(true);
  });

  it("never fires for a closed entry", () => {
    expect(
      shouldAlert({ ...running, endedAt: after(13) }, after(20), 12),
    ).toBe(false);
  });

  it("never fires twice for the same entry", () => {
    expect(
      shouldAlert({ ...running, alertSentAt: after(12) }, after(48), 12),
    ).toBe(false);
  });

  it("respects a custom threshold", () => {
    expect(shouldAlert(running, after(5), 4)).toBe(true);
    expect(shouldAlert(running, after(5), 6)).toBe(false);
  });
});

describe("isHeartbeatStale", () => {
  it("stays quiet before the scheduler has ever run", () => {
    expect(isHeartbeatStale(null, after(100))).toBe(false);
  });

  it("is fine within a day", () => {
    expect(isHeartbeatStale(start, after(23))).toBe(false);
  });

  it("flags a scheduler that has gone silent", () => {
    expect(isHeartbeatStale(start, after(25))).toBe(true);
  });
});
