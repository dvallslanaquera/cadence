/**
 * End-to-end smoke test over real HTTP. Mints a valid Auth.js session cookie so
 * the authenticated paths can be exercised without going through the login —
 * which is also the only way to prove the middleware, the 401 JSON contract and
 * the streamed CSV actually work together.
 *
 * Start the app first (same AUTH_SECRET and DATABASE_URL), then:
 *   npm run check:http
 *
 * It writes entries into whichever database the app points at.
 */
import { encode } from "next-auth/jwt";
import { shiftWeeks, startOfLocalWeek } from "@/domain/time";

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3123";
const SECRET = process.env.AUTH_SECRET!;
const COOKIE = "authjs.session-token";

let passed = 0;
let failed = 0;
function ok(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}`, JSON.stringify(detail)?.slice(0, 200) ?? "");
  }
}

async function main() {
  const token = await encode({
    token: { name: "Verify", email: process.env.ALLOWED_EMAIL, sub: "verify" },
    secret: SECRET,
    salt: COOKIE,
    maxAge: 3600,
  });
  const headers = { cookie: `${COOKIE}=${token}`, "content-type": "application/json" };

  console.log("\n— authenticated pages —");
  for (const path of ["/", "/backlog", "/dashboard", "/settings"]) {
    const res = await fetch(`${BASE}${path}`, { headers, redirect: "manual" });
    const html = await res.text();
    ok(
      `${path} renders for a signed-in user`,
      res.status === 200 && html.includes("<html"),
      res.status,
    );
  }

  console.log("\n— API round trip —");
  const settings = await fetch(`${BASE}/api/settings`, { headers }).then((r) => r.json());
  ok("settings returns the home zone", settings.settings?.timezone === "Asia/Tokyo", settings);

  const started = await fetch(`${BASE}/api/timer/start`, {
    method: "POST",
    headers,
    body: JSON.stringify({ description: "smoke test" }),
  }).then((r) => r.json());
  ok("timer starts", started.entry?.endedAt === null, started);

  const running = await fetch(`${BASE}/api/entries/running`, { headers }).then((r) => r.json());
  ok("running endpoint reports it", running.entry?.id === started.entry.id, running);
  ok("running endpoint carries the alert threshold", running.alertAfterHours === 12, running);

  const stopped = await fetch(`${BASE}/api/timer/stop`, { method: "POST", headers }).then((r) =>
    r.json(),
  );
  ok("timer stops", stopped.entry?.endedAt !== null, stopped);

  // Overlap rejection through the real HTTP layer.
  const clash = await fetch(`${BASE}/api/entries`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      description: "clash",
      startedAt: stopped.entry.startedAt,
      endedAt: stopped.entry.endedAt,
    }),
  });
  const clashBody = await clash.json();
  ok("an overlapping POST returns 409 with a readable message", clash.status === 409, clash.status);
  ok("the message names the conflict", String(clashBody.error).startsWith("Overlaps"), clashBody);

  const projects = await fetch(`${BASE}/api/projects`, { headers }).then((r) => r.json());
  ok("projects lists Others", projects.projects?.some((p: { name: string }) => p.name === "Others"), projects);

  const task = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "smoke task", dueDate: "2026-07-29" }),
  }).then((r) => r.json());
  ok("task created with a due date", task.task?.dueDate === "2026-07-29", task);
  ok("a task defaults to the work section", task.task?.section === "WORK", task.task);

  const study = await fetch(`${BASE}/api/tasks`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: "smoke study task", section: "STUDY" }),
  }).then((r) => r.json());
  ok("a task can be created in the study section", study.task?.section === "STUDY", study.task);

  const studyOnly = await fetch(`${BASE}/api/tasks?section=STUDY`, { headers }).then((r) =>
    r.json(),
  );
  ok(
    "the section filter returns that section and nothing else",
    studyOnly.tasks?.length > 0 &&
      studyOnly.tasks.every((t: { section: string }) => t.section === "STUDY"),
    studyOnly.tasks?.map((t: { name: string; section: string }) => `${t.name}:${t.section}`),
  );

  const csv = await fetch(
    `${BASE}/api/export.csv?from=2026-07-01T00:00:00Z&to=2026-09-01T00:00:00Z`,
    { headers },
  );
  const csvText = await csv.text();
  ok("CSV export streams with the right headers", csv.headers.get("content-type")?.includes("text/csv") === true);
  ok("CSV has the header row", csvText.startsWith("Project,Task,Description,"), csvText.slice(0, 60));

  // Derived from the zone the server reports, not hardcoded: a UTC range that
  // is exactly one week in one zone spans eight local days in another.
  const zone: string = settings.settings?.timezone ?? "UTC";
  const weekFrom = startOfLocalWeek(new Date(), zone);
  const weekTo = shiftWeeks(weekFrom, zone, 1);

  const stats = await fetch(
    `${BASE}/api/stats/daily?from=${weekFrom.toISOString()}&to=${weekTo.toISOString()}`,
    { headers },
  ).then((r) => r.json());
  ok("daily stats returns seven days", stats.days?.length === 7, stats.days?.length);
  ok("daily stats carries the goal", stats.dailyGoalHours === 8, stats.dailyGoalHours);

  const weekly = await fetch(`${BASE}/api/stats/weekly?weeks=20`, { headers }).then((r) => r.json());
  ok("weekly stats returns 20 weeks", weekly.weeks?.length === 20, weekly.weeks?.length);

  console.log("\n— a bad request is still a clean error —");
  const bad = await fetch(`${BASE}/api/entries?from=nonsense&to=also-nonsense`, { headers });
  ok("malformed dates give a 400", bad.status === 400, bad.status);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
