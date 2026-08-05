/** Runaway-timer predicate (ARCHITECTURE.md §12); pure for testing without a DB or clock. */

const MS_PER_HOUR = 3_600_000;

export interface AlertCandidate {
  startedAt: Date;
  /** null = still running. A closed entry is never a runaway. */
  endedAt: Date | null;
  /** Set once an email has gone out. One email per entry, ever. */
  alertSentAt: Date | null;
}

export function shouldAlert(
  entry: AlertCandidate,
  now: Date,
  thresholdHours: number,
): boolean {
  if (entry.endedAt !== null) return false;
  if (entry.alertSentAt !== null) return false;
  return now.getTime() - entry.startedAt.getTime() >= thresholdHours * MS_PER_HOUR;
}

export function elapsedHours(startedAt: Date, now: Date): number {
  return Math.round(((now.getTime() - startedAt.getTime()) / MS_PER_HOUR) * 10) / 10;
}

/** The heartbeat is stale if the scheduler hasn't checked in for this long. */
export const HEARTBEAT_STALE_HOURS = 24;

export function isHeartbeatStale(lastCheckAt: Date | null, now: Date): boolean {
  if (!lastCheckAt) return false; // never run yet; don't nag before first deploy
  return now.getTime() - lastCheckAt.getTime() > HEARTBEAT_STALE_HOURS * MS_PER_HOUR;
}
