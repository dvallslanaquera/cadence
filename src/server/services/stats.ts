/**
 * Aggregation happens in SQL, not in Node. That matters for entries spanning
 * midnight: each day is clipped to its own local bounds, so a 22:00 -> 02:00
 * entry contributes its real minutes to both days. See ARCHITECTURE.md §6.
 *
 * `AT TIME ZONE` is used in both directions:
 *   timestamptz AT TIME ZONE tz -> local wall time (for bucketing)
 *   timestamp   AT TIME ZONE tz -> the instant that wall time happened
 *
 * Running entries count up to NOW(), so today's numbers move as you work.
 *
 * The `FILTER (WHERE e.id IS NOT NULL)` on every bucketed SUM is load-bearing.
 * generate_series LEFT JOINs entries, so a bucket with no time produces one
 * all-NULL row — and that row does NOT sum to nothing: COALESCE turns the null
 * end into NOW(), while GREATEST silently ignores the null start and returns
 * the bucket's own start. An empty day used to report a full 24 hours and an
 * empty week a full 168. The filter drops those phantom rows before they sum.
 */
import { db } from "@/server/db";

export interface DailyStat {
  day: string;
  minutes: number;
}

export interface WeeklyStat {
  week: string;
  weekStart: string;
  minutes: number;
}

export interface ProjectStat {
  projectId: string;
  name: string;
  color: string;
  minutes: number;
}

export async function dailyStats(from: Date, to: Date, tz: string): Promise<DailyStat[]> {
  const rows = await db.$queryRaw<Array<{ day: string; minutes: number }>>`
    SELECT to_char(d.day, 'YYYY-MM-DD') AS day,
           COALESCE(SUM(
             EXTRACT(EPOCH FROM (
               LEAST(COALESCE(e."endedAt", NOW()), (d.day + INTERVAL '1 day') AT TIME ZONE ${tz})
               - GREATEST(e."startedAt", d.day AT TIME ZONE ${tz})
             )) / 60
           ) FILTER (WHERE e.id IS NOT NULL), 0)::int AS minutes
    FROM generate_series(
           date_trunc('day', ${from}::timestamptz AT TIME ZONE ${tz}),
           date_trunc('day', (${to}::timestamptz - INTERVAL '1 microsecond') AT TIME ZONE ${tz}),
           INTERVAL '1 day'
         ) AS d(day)
    LEFT JOIN "TimeEntry" e
      ON e."startedAt" < (d.day + INTERVAL '1 day') AT TIME ZONE ${tz}
     AND COALESCE(e."endedAt", NOW()) > d.day AT TIME ZONE ${tz}
    GROUP BY d.day
    ORDER BY d.day
  `;
  return rows.map((row) => ({ day: row.day, minutes: Number(row.minutes) }));
}

export async function weeklyStats(
  from: Date,
  to: Date,
  tz: string,
): Promise<WeeklyStat[]> {
  const rows = await db.$queryRaw<
    Array<{ week: string; weekStart: string; minutes: number }>
  >`
    SELECT to_char(w.week, 'IYYY-"W"IW') AS week,
           to_char(w.week, 'YYYY-MM-DD') AS "weekStart",
           COALESCE(SUM(
             EXTRACT(EPOCH FROM (
               LEAST(COALESCE(e."endedAt", NOW()), (w.week + INTERVAL '1 week') AT TIME ZONE ${tz})
               - GREATEST(e."startedAt", w.week AT TIME ZONE ${tz})
             )) / 60
           ) FILTER (WHERE e.id IS NOT NULL), 0)::int AS minutes
    FROM generate_series(
           date_trunc('week', ${from}::timestamptz AT TIME ZONE ${tz}),
           date_trunc('week', (${to}::timestamptz - INTERVAL '1 microsecond') AT TIME ZONE ${tz}),
           INTERVAL '1 week'
         ) AS w(week)
    LEFT JOIN "TimeEntry" e
      ON e."startedAt" < (w.week + INTERVAL '1 week') AT TIME ZONE ${tz}
     AND COALESCE(e."endedAt", NOW()) > w.week AT TIME ZONE ${tz}
    GROUP BY w.week
    ORDER BY w.week
  `;
  return rows.map((row) => ({
    week: row.week,
    weekStart: row.weekStart,
    minutes: Number(row.minutes),
  }));
}

export async function projectStats(
  from: Date,
  to: Date,
): Promise<ProjectStat[]> {
  const rows = await db.$queryRaw<
    Array<{ projectId: string; name: string; color: string; minutes: number }>
  >`
    SELECT p.id AS "projectId",
           p.name AS name,
           p.color AS color,
           COALESCE(SUM(
             EXTRACT(EPOCH FROM (
               LEAST(COALESCE(e."endedAt", NOW()), ${to}::timestamptz)
               - GREATEST(e."startedAt", ${from}::timestamptz)
             )) / 60
           ), 0)::int AS minutes
    FROM "TimeEntry" e
    JOIN "Project" p ON p.id = e."projectId"
    WHERE e."startedAt" < ${to}::timestamptz
      AND COALESCE(e."endedAt", NOW()) > ${from}::timestamptz
    GROUP BY p.id, p.name, p.color
    HAVING SUM(
             EXTRACT(EPOCH FROM (
               LEAST(COALESCE(e."endedAt", NOW()), ${to}::timestamptz)
               - GREATEST(e."startedAt", ${from}::timestamptz)
             )) / 60
           ) > 0
    ORDER BY minutes DESC
  `;
  return rows.map((row) => ({ ...row, minutes: Number(row.minutes) }));
}

export interface SummaryStat {
  totalMinutes: number;
  activeDays: number;
  longestDayMinutes: number;
  longestDay: string | null;
}

export async function summaryStats(
  from: Date,
  to: Date,
  tz: string,
): Promise<SummaryStat> {
  const days = await dailyStats(from, to, tz);
  const worked = days.filter((day) => day.minutes > 0);
  const longest = worked.reduce<DailyStat | null>(
    (best, day) => (best === null || day.minutes > best.minutes ? day : best),
    null,
  );

  return {
    totalMinutes: days.reduce((sum, day) => sum + day.minutes, 0),
    activeDays: worked.length,
    longestDayMinutes: longest?.minutes ?? 0,
    longestDay: longest?.day ?? null,
  };
}
