import { describe, expect, it } from "vitest";
import { findConflicts, validateEntryShape } from "./overlap";

const at = (iso: string) => new Date(iso);

const existing = [
  {
    id: "standup",
    description: "Standup",
    startedAt: at("2026-07-28T09:00:00Z"),
    endedAt: at("2026-07-28T09:15:00Z"),
  },
  {
    id: "deep-work",
    description: "Deep work",
    startedAt: at("2026-07-28T10:00:00Z"),
    endedAt: at("2026-07-28T12:00:00Z"),
  },
];

describe("findConflicts", () => {
  it("allows entries that abut exactly — this is what makes stop-then-start work", () => {
    const conflicts = findConflicts(
      { startedAt: at("2026-07-28T09:15:00Z"), endedAt: at("2026-07-28T10:00:00Z") },
      existing,
    );
    expect(conflicts).toEqual([]);
  });

  it("rejects a one-minute overlap", () => {
    const conflicts = findConflicts(
      { startedAt: at("2026-07-28T09:14:00Z"), endedAt: at("2026-07-28T09:30:00Z") },
      existing,
    );
    expect(conflicts.map((c) => c.id)).toEqual(["standup"]);
  });

  it("rejects an entry that swallows another whole", () => {
    const conflicts = findConflicts(
      { startedAt: at("2026-07-28T08:00:00Z"), endedAt: at("2026-07-28T13:00:00Z") },
      existing,
    );
    expect(conflicts.map((c) => c.id)).toEqual(["standup", "deep-work"]);
  });

  it("lets an entry be edited without colliding with itself", () => {
    const conflicts = findConflicts(
      {
        id: "standup",
        startedAt: at("2026-07-28T09:00:00Z"),
        endedAt: at("2026-07-28T09:30:00Z"),
      },
      existing,
    );
    expect(conflicts).toEqual([]);
  });

  it("treats a running entry as ending now, not at the end of time", () => {
    const running = [
      {
        id: "running",
        startedAt: at("2026-07-28T14:00:00Z"),
        endedAt: null,
      },
    ];
    const now = at("2026-07-28T15:00:00Z");

    // Before the running entry started: fine.
    expect(
      findConflicts(
        { startedAt: at("2026-07-28T13:00:00Z"), endedAt: at("2026-07-28T14:00:00Z") },
        running,
        now,
      ),
    ).toEqual([]);

    // Inside the running entry's span: conflict.
    expect(
      findConflicts(
        { startedAt: at("2026-07-28T14:30:00Z"), endedAt: at("2026-07-28T14:45:00Z") },
        running,
        now,
      ).map((c) => c.id),
    ).toEqual(["running"]);

    // Entirely in the future, after "now": fine.
    expect(
      findConflicts(
        { startedAt: at("2026-07-28T16:00:00Z"), endedAt: at("2026-07-28T17:00:00Z") },
        running,
        now,
      ),
    ).toEqual([]);
  });
});

describe("validateEntryShape", () => {
  it("rejects an end at or before the start", () => {
    expect(
      validateEntryShape({
        startedAt: at("2026-07-28T09:00:00Z"),
        endedAt: at("2026-07-28T09:00:00Z"),
      }),
    ).toEqual({ kind: "end-before-start" });

    expect(
      validateEntryShape({
        startedAt: at("2026-07-28T09:00:00Z"),
        endedAt: at("2026-07-28T08:00:00Z"),
      }),
    ).toEqual({ kind: "end-before-start" });
  });

  it("accepts the one-minute minimum", () => {
    expect(
      validateEntryShape({
        startedAt: at("2026-07-28T09:00:00Z"),
        endedAt: at("2026-07-28T09:01:00Z"),
      }),
    ).toBeNull();
  });

  it("accepts a multi-day span", () => {
    expect(
      validateEntryShape({
        startedAt: at("2026-07-28T09:00:00Z"),
        endedAt: at("2026-07-31T09:00:00Z"),
      }),
    ).toBeNull();
  });
});
