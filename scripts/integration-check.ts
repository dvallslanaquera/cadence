/**
 * Integration check against a real Postgres. Proves the things unit tests
 * cannot: the hand-written migrations, the database-level constraints, and the
 * raw stats SQL. See ARCHITECTURE.md §14.
 *
 *   docker run -d --name cadence-db -e POSTGRES_PASSWORD=cadence \
 *     -e POSTGRES_DB=cadence -p 55432:5432 postgres:16
 *   DATABASE_URL=postgresql://postgres:cadence@localhost:55432/cadence \
 *     npm run db:deploy && npm run db:seed && npm run check:db
 *
 * It truncates the database it points at. Never aim it at real data.
 */
import { db } from "../src/server/db";
import {
  createEntry,
  deleteEntry,
  getRunningEntry,
  listEntries,
  startTimer,
  stopTimer,
} from "../src/server/services/entries";
import {
  dailyStats,
  projectStats,
  summaryStats,
  weeklyStats,
} from "../src/server/services/stats";
import { streamEntriesCsv } from "../src/server/services/export";
import {
  createProject,
  deleteProject,
  frequentProjectIds,
  updateProject,
} from "../src/server/services/projects";
import { runAlertCheck } from "../src/server/services/alerts";

const TZ = "Europe/Madrid";
let passed = 0;
let failed = 0;

function ok(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`, detail ?? "");
  }
}

async function expectThrows(name: string, fn: () => Promise<unknown>, match?: string) {
  try {
    await fn();
    ok(name, false, "expected a rejection, got success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ok(name, match ? message.includes(match) : true, match ? message.slice(0, 160) : undefined);
  }
}

async function reset() {
  await db.tagsOnEntries.deleteMany();
  await db.timeEntry.deleteMany();
  await db.task.deleteMany();
  await db.project.deleteMany({ where: { isSystem: false } });
}

async function main() {
  await reset();
  const others = await db.project.findFirstOrThrow({ where: { isSystem: true } });

  console.log("\n— timer lifecycle —");
  const first = await startTimer({ description: "first", tags: [] });
  ok("start creates a running entry", first.endedAt === null);
  ok("running entry is findable", (await getRunningEntry())?.id === first.id);

  const second = await startTimer({ description: "second", tags: [] });
  const closedFirst = await db.timeEntry.findUniqueOrThrow({ where: { id: first.id } });
  ok("starting again closes the previous entry", closedFirst.endedAt !== null);
  ok(
    "the two entries abut exactly (half-open ranges, no overlap)",
    closedFirst.endedAt!.getTime() === new Date(second.startedAt).getTime(),
  );
  ok("only one entry runs at a time", (await db.timeEntry.count({ where: { endedAt: null } })) === 1);

  const stopped = await stopTimer();
  ok("stop closes the running entry", stopped.endedAt !== null);
  ok(
    "a sub-minute entry still gets its one-minute minimum",
    new Date(stopped.endedAt!).getTime() - new Date(stopped.startedAt).getTime() >= 60_000,
  );
  await expectThrows("stopping with nothing running is a 404", () => stopTimer(), "No timer is running");

  console.log("\n— overlap rules —");
  await reset();
  const base = await createEntry(
    {
      description: "Standup",
      startedAt: new Date("2026-07-28T07:00:00Z"),
      endedAt: new Date("2026-07-28T07:15:00Z"),
      tags: [],
    },
    TZ,
  );
  ok("manual entry created", base.id.length > 0);

  const abutting = await createEntry(
    {
      description: "Deep work",
      startedAt: new Date("2026-07-28T07:15:00Z"),
      endedAt: new Date("2026-07-28T09:00:00Z"),
      tags: [],
    },
    TZ,
  );
  ok("an abutting entry is allowed", abutting.id.length > 0);

  await expectThrows(
    "a one-minute overlap is rejected with a readable message",
    () =>
      createEntry(
        {
          description: "clash",
          startedAt: new Date("2026-07-28T07:14:00Z"),
          endedAt: new Date("2026-07-28T07:30:00Z"),
          tags: [],
        },
        TZ,
      ),
    "Overlaps",
  );

  await expectThrows(
    "an end before the start is rejected",
    () =>
      createEntry(
        {
          startedAt: new Date("2026-07-28T10:00:00Z"),
          endedAt: new Date("2026-07-28T09:00:00Z"),
          description: "",
          tags: [],
        },
        TZ,
      ),
    "after the start",
  );

  console.log("\n— database-level guarantees (bypassing the service layer) —");
  await expectThrows(
    "exclusion constraint blocks a raw overlapping insert",
    () =>
      db.timeEntry.create({
        data: {
          description: "raw clash",
          projectId: others.id,
          startedAt: new Date("2026-07-28T07:05:00Z"),
          endedAt: new Date("2026-07-28T07:10:00Z"),
        },
      }),
    "no_overlapping_entries",
  );

  await db.timeEntry.create({
    data: { description: "runner", projectId: others.id, startedAt: new Date("2026-07-28T20:00:00Z") },
  });
  await expectThrows(
    "partial unique index blocks a second running entry",
    () =>
      db.timeEntry.create({
        data: {
          description: "second runner",
          projectId: others.id,
          startedAt: new Date("2026-07-28T21:00:00Z"),
        },
      }),
    "Unique constraint failed",
  );
  await db.timeEntry.deleteMany({ where: { endedAt: null } });

  await expectThrows(
    "check constraint blocks a zero-length entry",
    () =>
      db.timeEntry.create({
        data: {
          description: "zero",
          projectId: others.id,
          startedAt: new Date("2026-07-28T12:00:00Z"),
          endedAt: new Date("2026-07-28T12:00:00Z"),
        },
      }),
    "end_after_start",
  );

  await expectThrows(
    "the trigger refuses to delete the system project",
    () => db.project.delete({ where: { id: others.id } }),
    "system project cannot be deleted",
  );
  ok(
    "the system project is still there",
    (await db.project.findUnique({ where: { id: others.id } })) !== null,
  );

  console.log("\n— project deletion reassigns rather than destroying —");
  const client = await createProject({ name: "Client work", color: "#eb6834" });
  await db.timeEntry.updateMany({ where: { id: base.id }, data: { projectId: client.id } });
  await db.task.create({ data: { name: "a task", projectId: client.id } });
  const moved = await deleteProject(client.id);
  ok("delete reports what it moved", moved.entries === 1 && moved.tasks === 1, moved);
  const survivor = await db.timeEntry.findUniqueOrThrow({ where: { id: base.id } });
  ok("the entry survived, reassigned to Others", survivor.projectId === others.id);

  console.log("\n— multi-day entries and the stats SQL —");
  await reset();
  // 22:00 Tue -> 06:00 Wed local (CEST = UTC+2).
  await db.timeEntry.create({
    data: {
      description: "Overnight",
      projectId: others.id,
      startedAt: new Date("2026-07-28T20:00:00Z"),
      endedAt: new Date("2026-07-29T04:00:00Z"),
    },
  });

  const days = await dailyStats(
    new Date("2026-07-26T22:00:00Z"),
    new Date("2026-08-02T22:00:00Z"),
    TZ,
  );
  const tue = days.find((d) => d.day === "2026-07-28");
  const wed = days.find((d) => d.day === "2026-07-29");
  ok("the week returns seven days", days.length === 7, days.length);
  ok("Tuesday gets 120 minutes", tue?.minutes === 120, tue);
  ok("Wednesday gets 360 minutes", wed?.minutes === 360, wed);
  ok("the split preserves the total", (tue?.minutes ?? 0) + (wed?.minutes ?? 0) === 480);

  // A bucket with no entries is a LEFT JOIN null row, and null arithmetic in
  // this query does not come out as zero unless it is filtered away.
  const empty = days.filter((d) => d.day !== "2026-07-28" && d.day !== "2026-07-29");
  ok(
    "days with no entries report zero, not a full day",
    empty.every((d) => d.minutes === 0),
    empty.filter((d) => d.minutes !== 0),
  );

  // Madrid is UTC+1 in January, so local midnight is 23:00Z — not the 22:00Z
  // that bounds the July cases above.
  const noneDays = await dailyStats(
    new Date("2026-01-04T23:00:00Z"),
    new Date("2026-01-11T23:00:00Z"),
    TZ,
  );
  ok(
    "a week with no entries at all is zero across every day",
    noneDays.length === 7 && noneDays.every((d) => d.minutes === 0),
    noneDays.filter((d) => d.minutes !== 0),
  );

  const noneWeeks = await weeklyStats(
    new Date("2026-01-04T23:00:00Z"),
    new Date("2026-01-25T23:00:00Z"),
    TZ,
  );
  ok(
    "weeks with no entries report zero, not 168 hours",
    noneWeeks.length > 0 && noneWeeks.every((w) => w.minutes === 0),
    noneWeeks.filter((w) => w.minutes !== 0),
  );

  const summary = await summaryStats(
    new Date("2026-07-26T22:00:00Z"),
    new Date("2026-08-02T22:00:00Z"),
    TZ,
  );
  ok("summary counts only the days actually worked", summary.activeDays === 2, summary);
  ok("summary totals the real minutes", summary.totalMinutes === 480, summary);
  ok("summary picks the longest day", summary.longestDay === "2026-07-29", summary);

  const weeks = await weeklyStats(
    new Date("2026-07-26T22:00:00Z"),
    new Date("2026-08-02T22:00:00Z"),
    TZ,
  );
  ok("weekly rollup returns one ISO week", weeks.length === 1, weeks);
  ok("weekly rollup totals 480 minutes", weeks[0]?.minutes === 480, weeks[0]);
  ok("weekly key is the ISO week", weeks[0]?.week === "2026-W31", weeks[0]?.week);

  const byProject = await projectStats(
    new Date("2026-07-26T22:00:00Z"),
    new Date("2026-08-02T22:00:00Z"),
  );
  ok("project rollup totals 480 minutes", byProject[0]?.minutes === 480, byProject);

  console.log("\n— DST: a 25-hour Sunday adds up to 25 hours —");
  await reset();
  await db.timeEntry.create({
    data: {
      description: "All of the long day",
      projectId: others.id,
      startedAt: new Date("2026-10-24T22:00:00Z"), // 00:00 local Sun 25 Oct
      endedAt: new Date("2026-10-25T23:00:00Z"), // 00:00 local Mon 26 Oct
    },
  });
  const dstDays = await dailyStats(
    new Date("2026-10-24T22:00:00Z"),
    new Date("2026-10-25T23:00:00Z"),
    TZ,
  );
  const sunday = dstDays.find((d) => d.day === "2026-10-25");
  ok("the fall-back Sunday measures 1500 minutes", sunday?.minutes === 1500, sunday);

  console.log("\n— CSV export —");
  await reset();
  await createEntry(
    {
      description: 'Email, "triage"',
      startedAt: new Date("2026-07-27T07:12:00Z"),
      endedAt: new Date("2026-07-27T07:48:00Z"),
      tags: ["admin", "inbox"],
    },
    TZ,
  );
  const stream = streamEntriesCsv(
    new Date("2026-07-26T22:00:00Z"),
    new Date("2026-08-02T22:00:00Z"),
    TZ,
  );
  const csv = await new Response(stream).text();
  const lines = csv.trim().split("\r\n");
  ok("header is the CSV column layout", lines[0].startsWith("Project,Task,Description,"));
  ok("one data row", lines.length === 2, lines.length);
  ok("wall-clock times are in the home zone", lines[1].includes("09:12"), lines[1]);
  ok("embedded quotes and commas are escaped", lines[1].includes('"Email, ""triage"""'), lines[1]);
  ok("multi-tag cell is quoted", lines[1].includes('"admin, inbox"'), lines[1]);

  console.log("\n— alert check —");
  await reset();
  await db.settings.update({ where: { id: 1 }, data: { alertAfterHours: 12 } });
  const quiet = await runAlertCheck();
  ok("nothing running means no email", quiet.sent === false, quiet);
  const heartbeat = await db.settings.findUniqueOrThrow({ where: { id: 1 } });
  ok("the heartbeat is stamped even when nothing was sent", heartbeat.lastAlertCheckAt !== null);

  await db.timeEntry.create({
    data: { description: "young", projectId: others.id, startedAt: new Date(Date.now() - 3_600_000) },
  });
  const under = await runAlertCheck();
  ok("a one-hour timer is under the threshold", under.sent === false && under.reason === "under threshold", under);

  console.log("\n— frequent projects —");
  await reset();
  {
    const day = 24 * 60 * 60 * 1000;
    const alpha = await createProject({ name: "Alpha", color: "#2a78d6" });
    const beta = await createProject({ name: "Beta", color: "#eb6834" });
    const stale = await createProject({ name: "Stale", color: "#1baf7a" });
    const gone = await createProject({ name: "Gone", color: "#eda100" });

    // Beta gets more entries; Alpha gets far more minutes. Ranking is by count,
    // so Beta must win.
    const add = (projectId: string, startedAt: Date, minutes: number) =>
      db.timeEntry.create({
        data: {
          description: "x",
          projectId,
          startedAt,
          endedAt: new Date(startedAt.getTime() + minutes * 60_000),
        },
      });

    await add(alpha.id, new Date(Date.now() - 2 * day), 480);
    for (let i = 0; i < 4; i++) {
      await add(beta.id, new Date(Date.now() - 3 * day + i * 3_600_000), 30);
    }
    // Outside the 30-day window, so it must not appear at all.
    await add(stale.id, new Date(Date.now() - 90 * day), 600);
    // Archived projects are never somewhere new time should be logged.
    await add(gone.id, new Date(Date.now() - day), 60);
    await updateProject(gone.id, { archived: true });

    const ranked = await frequentProjectIds(30, 5);
    ok("ranks by entry count, not minutes logged", ranked[0] === beta.id, ranked);
    ok("includes a project with fewer entries", ranked.includes(alpha.id), ranked);
    ok("excludes activity older than the window", !ranked.includes(stale.id), ranked);
    ok("excludes archived projects", !ranked.includes(gone.id), ranked);

    const limited = await frequentProjectIds(30, 1);
    ok("respects the limit", limited.length === 1 && limited[0] === beta.id, limited);
  }

  console.log("\n— listing —");
  await reset();
  const e = await createEntry(
    {
      description: "listed",
      startedAt: new Date("2026-07-28T07:00:00Z"),
      endedAt: new Date("2026-07-28T08:00:00Z"),
      tags: ["x"],
    },
    TZ,
  );
  const listed = await listEntries(new Date("2026-07-26T22:00:00Z"), new Date("2026-08-02T22:00:00Z"));
  ok("the entry comes back with its relations", listed[0]?.project.name === "Others" && listed[0]?.tags[0] === "x", listed[0]);
  await deleteEntry(e.id);
  ok("delete removes it", (await db.timeEntry.count()) === 0);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await reset();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
