/**
 * DB also enforces overlaps (ARCHITECTURE.md §4); this layer gives friendlier
 * messages. Intervals are half-open [start, end) so abutting entries don't
 * conflict, which is what makes stop-then-start work.
 */

export interface Interval {
  id: string;
  description?: string;
  startedAt: Date;
  /** null = currently running. */
  endedAt: Date | null;
}

export interface Candidate {
  /** Set when editing, so an entry never conflicts with itself. */
  id?: string;
  startedAt: Date;
  endedAt: Date;
}

export function intervalsOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Existing entries the candidate collides with; a running entry ends "now". */
export function findConflicts<T extends Interval>(
  candidate: Candidate,
  existing: T[],
  now: Date = new Date(),
): T[] {
  return existing.filter((other) => {
    if (candidate.id && other.id === candidate.id) return false;
    const otherEnd = other.endedAt ?? now;
    if (!(otherEnd > other.startedAt)) return false;
    return intervalsOverlap(candidate.startedAt, candidate.endedAt, other.startedAt, otherEnd);
  });
}

export const MIN_ENTRY_MINUTES = 1;

export type EntryValidationError =
  | { kind: "end-before-start" }
  | { kind: "too-short"; minimumMinutes: number };

/** Shape checks that don't need the database. */
export function validateEntryShape(candidate: Candidate): EntryValidationError | null {
  if (candidate.endedAt <= candidate.startedAt) return { kind: "end-before-start" };
  const minutes = (candidate.endedAt.getTime() - candidate.startedAt.getTime()) / 60_000;
  if (minutes < MIN_ENTRY_MINUTES) {
    return { kind: "too-short", minimumMinutes: MIN_ENTRY_MINUTES };
  }
  return null;
}
