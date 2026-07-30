# Cadence — Architecture

A single-user time tracker in the shape of Toggl: a week calendar you log time on, a
backlog of tasks you can start a timer from, and a dashboard.

Status: **design proposal, no code written yet.** Read it, mark up anything wrong, and
I'll build from the corrected version.

---

## Contents

1. [Decisions already made](#1-decisions-already-made)
2. [Stack](#2-stack)
3. [Deployment topology](#3-deployment-topology)
4. [Data model](#4-data-model)
5. [Domain rules](#5-domain-rules)
6. [API surface](#6-api-surface)
7. [Frontend structure](#7-frontend-structure)
8. [The week grid](#8-the-week-grid)
9. [Backlog tab](#9-backlog-tab)
10. [Dashboard tab](#10-dashboard-tab)
11. [CSV export](#11-csv-export)
12. [Runaway timer alert](#12-runaway-timer-alert)
13. [Mobile & PWA](#13-mobile--pwa)
14. [Testing](#14-testing)
15. [Environment & setup](#15-environment--setup)
16. [Build order](#16-build-order)
17. [Assumptions I made without asking](#17-assumptions-i-made-without-asking)
18. [Deliberately out of scope](#18-deliberately-out-of-scope)

---

## 1. Decisions already made

From your answers:

| Area | Decision |
|---|---|
| Topology | Next.js (UI + API) on Vercel, Postgres on Railway. No worker service |
| Auth | Email + password via Auth.js Credentials, one account in env |
| Hierarchy | Project → Task → TimeEntry, plus Tags. No Client/Workspace layer, no billable |
| Backlog | Backlog items **are** Tasks; each has a Start button that opens a running entry linked to it |
| Time zone | One fixed home zone in settings; grid always renders in it |
| Runaway timers | No autostop — nothing is ever truncated. A scheduled check emails you once when a running entry passes 12h |
| Overlaps | Not allowed. Starting a timer stops the running one; conflicting manual entries rejected |
| Sync | Installable PWA, online-only writes, running timer refetches on focus and every 30s |
| Grid click | Click = start a live timer at that minute; drag = completed entry over the dragged range |
| CSV | Toggl Detailed-report columns, date-range picker defaulting to the visible week |
| Deletes | Projects archive by default; a real delete reassigns its entries and tasks to Others |
| Dashboard | Configurable daily goal, drawn as a reference line on the day and week charts |

---

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | One codebase for UI and API; deploys to Vercel with zero config |
| Styling | Tailwind CSS v4 | The week grid is mostly arithmetic on inline styles; Tailwind covers the rest |
| Components | Radix primitives (Popover, Dialog, Select, Collapsible) + local wrappers | Accessible behaviour for the popovers this app leans on, without adopting a whole design system |
| Server state | TanStack Query v5 | Gives refetch-on-focus, polling, and optimistic updates — exactly the sync model chosen |
| Charts | Recharts | Three chart types needed, all first-class; SSR-safe |
| Dates | `date-fns` v4 + `@date-fns/tz` | Zone-aware arithmetic without pulling in Moment/Luxon's weight |
| DB | Postgres 16 (Railway) | Range types + exclusion constraints do the overlap enforcement for free |
| ORM | Prisma | Typed queries and a migration story; raw SQL where Prisma can't express a constraint |
| Validation | Zod, shared between route handlers and forms | One schema per payload, inferred types on both sides |
| Email | Resend | Free tier, ~5-line integration, and it can send to your own account address with no domain to verify |
| Scheduling | GitHub Actions cron → protected API route | The only scheduled component in the system; free, with no always-on service to host |
| Tests | Vitest for domain logic | The tricky parts are pure functions; that's where the tests go |

No state management library. Server state lives in TanStack Query; the handful of UI-only
bits (which week is visible, which popover is open) are `useState` in the page component.

---

## 3. Deployment topology

```
   GitHub Actions ──── every 15 min, x-cron-key header ───┐
   (schedule: */15)                                       │
                                                          ▼
┌─────────────────────────── Vercel ───────────────────────────┐
│  Next.js app                                                 │
│    /               week grid   (RSC shell + client grid)     │
│    /backlog        task list                                 │
│    /dashboard      charts                                    │
│    /api/*          route handlers (zod → service → Prisma)   │
│    /api/auth/*     Auth.js, Credentials provider             │
│    /api/alerts/check   runaway-timer check ──► Resend ──► 📧 │
└───────────────────────────┬──────────────────────────────────┘
                            │ DATABASE_URL (pooled, TLS)
┌───────────────────────────▼─────────── Railway ──────────────┐
│  Postgres 16     ← single source of truth, and nothing else  │
└──────────────────────────────────────────────────────────────┘
```

One repo, two deploy targets:

```
cadence/
├── src/                        → Vercel (Next.js app, alert route included)
├── prisma/schema.prisma
├── .github/workflows/alert.yml → the only scheduled thing in the system
└── package.json                → one package, no workspaces
```

Railway is now a database with nothing running beside it, and there is no second consumer
of the Prisma client to keep in sync. Migrations run from CI (or your laptop) against
Railway; Vercel builds only run `prisma generate`, never `migrate deploy`, so a bad deploy
can't mutate the database.

**Connection pooling.** Vercel's serverless functions open a connection per instance,
which Postgres will not enjoy. The app connects through Prisma's connection pool with a
low `connection_limit`, and I'd point `DATABASE_URL` at Railway's pooled port. If that
proves flaky under real use the fallback is Prisma Accelerate or a PgBouncer service on
Railway — noted so we don't rediscover it in production.

---

## 4. Data model

Toggl's hierarchy minus the layers a single user has no use for. No `userId` column
anywhere: you are the only user, and a row that always holds the same value is a column
that lies about the design. If this ever becomes multi-user, that's a migration adding
`userId` to four tables — cheap, and not worth carrying now.

```prisma
model Project {
  id        String   @id @default(cuid())
  name      String   @unique
  color     String              // hex from a fixed 12-swatch palette
  isSystem  Boolean  @default(false)   // true only for "Others"
  archivedAt DateTime?          // archived = hidden from pickers, history intact
  createdAt DateTime @default(now())

  tasks     Task[]
  entries   TimeEntry[]

  @@index([archivedAt])
}

model Task {                    // ← this IS the backlog
  id          String    @id @default(cuid())
  name        String
  notes       String?
  projectId   String              // never null; defaults to the Others project
  dueDate     DateTime? @db.Date  // a calendar date, not an instant
  status      TaskStatus @default(OPEN)
  section     TaskSection @default(WORK)  // the backlog's top-level split
  completedAt DateTime?
  sortOrder   Int                 // manual ordering within the backlog
  createdAt   DateTime  @default(now())

  project Project     @relation(fields: [projectId], references: [id])
  entries TimeEntry[]

  @@index([status, dueDate])
  @@index([projectId])
  @@index([section, status])
}

enum TaskStatus { OPEN DONE }
enum TaskSection { WORK STUDY }

model TimeEntry {
  id           String    @id @default(cuid())
  description  String    @default("")
  projectId    String              // never null; Others by default
  taskId       String?             // set when started from the backlog
  startedAt    DateTime  @db.Timestamptz(3)
  endedAt      DateTime? @db.Timestamptz(3)   // NULL = currently running
  alertSentAt  DateTime?           // when the 12h email went out; blocks repeats
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  project Project @relation(fields: [projectId], references: [id])
  task    Task?   @relation(fields: [taskId], references: [id], onDelete: SetNull)
  tags    TagsOnEntries[]

  @@index([startedAt])
  @@index([projectId, startedAt])
}

model Tag {
  id      String @id @default(cuid())
  name    String @unique
  entries TagsOnEntries[]
}

model TagsOnEntries {
  entryId String
  tagId   String
  entry   TimeEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)
  tag     Tag       @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([entryId, tagId])
}

model Settings {
  id             Int    @id @default(1)    // single row, enforced by a check constraint
  timezone       String @default("Asia/Tokyo")
  dailyGoalHours Float  @default(8)
  weeklyChartWeeks Int  @default(20)
  alertAfterHours  Int  @default(12)   // email threshold for a running entry
  lastAlertCheckAt DateTime?           // heartbeat; the UI warns if this goes stale
}
```

### Constraints Prisma can't express

These go in a hand-written migration:

```sql
-- 1. At most one running entry, ever.
CREATE UNIQUE INDEX one_running_entry
  ON "TimeEntry" ((endedAt IS NULL)) WHERE "endedAt" IS NULL;

-- 2. No two closed entries may overlap. Half-open ranges: [start, end).
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "TimeEntry" ADD CONSTRAINT no_overlapping_entries
  EXCLUDE USING gist (
    tstzrange("startedAt", "endedAt", '[)') WITH &&
  ) WHERE ("endedAt" IS NOT NULL);

-- 3. An entry never ends before it starts.
ALTER TABLE "TimeEntry" ADD CONSTRAINT end_after_start
  CHECK ("endedAt" IS NULL OR "endedAt" > "startedAt");

-- 4. Settings is a single row.
ALTER TABLE "Settings" ADD CONSTRAINT settings_singleton CHECK (id = 1);

-- 5. The Others project cannot be deleted. A TRIGGER, not a rule.
CREATE OR REPLACE FUNCTION protect_system_project() RETURNS trigger AS $$
BEGIN
  IF OLD."isSystem" THEN
    RAISE EXCEPTION 'The system project cannot be deleted'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_system_project
  BEFORE DELETE ON "Project"
  FOR EACH ROW EXECUTE FUNCTION protect_system_project();
```

> **Why a trigger and not a rule.** The first draft of this used
> `CREATE RULE … DO INSTEAD NOTHING`. Postgres then refuses `DELETE … RETURNING`
> on the *entire* table — and that is exactly what Prisma emits — so the rule
> broke deletion of every project, not just the protected one. The integration
> check caught it; typechecking and unit tests could not have. Raising is also
> better than silently doing nothing: the service layer already returns a 400
> here, so reaching the trigger means something bypassed it.

The exclusion constraint is the point I'd defend hardest. Overlap validation in
application code is a read-then-write race: two tabs, two requests, both check, both
insert. The database can't be raced. The service layer still checks first so the user gets
a readable "conflicts with *Standup*, 09:00–09:15" instead of a Postgres error — but the
constraint is what makes the rule true.

### Seeds

One `Others` project (`isSystem: true`, grey) and one `Settings` row.

---

## 5. Domain rules

All of these live in `src/domain/` as pure functions over plain data, with no Prisma or
React imports. That's what makes them testable, and these are the rules worth testing.

**Minute granularity.** Every persisted timestamp has its seconds and milliseconds zeroed.
Manual input is minute-based anyway; timer start/stop rounds to the nearest minute at the
moment of writing. The running clock in the UI ticks in seconds because a timer that
doesn't move looks broken — but what it displays is cosmetic, and what it saves is
minute-aligned. Minimum duration is 1 minute; a start-then-immediately-stop within the same
minute rounds to a 1-minute entry rather than a zero-length one.

**Starting a timer.** Atomically, in one transaction: round `now` to the minute, close the
running entry (if any) at that instant, insert the new entry with `startedAt` at the same
instant. Because both use the identical rounded value and ranges are half-open, the two
entries abut exactly and the exclusion constraint is satisfied.

**Overlap rejection.** Manual create/edit runs a conflict query first and returns HTTP 409
with the conflicting entries, which the UI renders as a specific message. The running entry
(`endedAt IS NULL`) is exempt from the constraint but is auto-closed by any new start.

**Multi-day entries.** Stored as one row, however long. Rendering splits them: a pure
`splitAcrossDays(entry, timezone)` returns one segment per local calendar day, so a
22:00→02:00 entry draws as a block at the bottom of Tuesday and another at the top of
Wednesday, each marked with a continuation arrow. Day and week totals use the same split,
so an entry crossing midnight contributes its real minutes to each day. Splitting happens
in the home time zone, which means DST days are correctly 23 or 25 hours long.

**Nothing truncates a timer.** A running entry runs until you stop it, however long that
takes, and a manual entry may span any range — above 24 hours the form warns but still
saves. The only guard against a forgotten timer is the 12-hour email (§12), which notifies
and changes nothing. The trade: your stored data is always literally what the clock did, at
the cost of a runaway timer staying wrong until you fix it by hand. The running-timer bar
turns amber past the alert threshold so an open tab makes it obvious too.

**Time zone.** Postgres stores `timestamptz` (UTC). Every conversion to and from wall-clock
time goes through one module that reads `Settings.timezone`. No `new Date()` formatting
anywhere in components — that's how a laptop in another country silently renders the wrong
week, and it's the single easiest bug to ship here.

**Deleting a project.** Archive is the default action in the UI. A real delete opens a
confirm dialog stating exactly how many entries and tasks will move to Others, then
reassigns them in a transaction. Time data is never destroyed by a project delete.

**Deleting a task.** Its entries survive with `taskId` set to null (`onDelete: SetNull`) —
the logged hours stay in the project, only the task link goes.

---

## 6. API surface

Route handlers under `/api`, each: authenticate → zod-parse → service function → JSON.
Route handlers rather than server actions because TanStack Query wants real endpoints to
poll, refetch, and optimistically update against.

| Method | Route | Purpose |
|---|---|---|
| GET | `/api/entries?from&to` | Entries overlapping the range, projects/tags included |
| POST | `/api/entries` | Create a completed entry (the drag case, and the add form) |
| PATCH | `/api/entries/:id` | Edit any field; re-validates overlap |
| DELETE | `/api/entries/:id` | Trash-icon delete |
| GET | `/api/entries/running` | The running entry, or null — the 30s poll target |
| POST | `/api/timer/start` | Stop-current + start-new, one transaction |
| POST | `/api/timer/stop` | Close the running entry at rounded now |
| GET/POST | `/api/projects` | List (with archived filter) / create |
| PATCH/DELETE | `/api/projects/:id` | Rename, recolor, archive/unarchive / delete + reassign |
| GET/POST | `/api/tasks` | Backlog list (filter by status, project, due date) / create |
| PATCH/DELETE | `/api/tasks/:id` | Edit, complete, reorder / delete |
| GET/POST | `/api/tags` | List / create |
| GET | `/api/stats/daily?from&to` | Minutes per local day |
| GET | `/api/stats/weekly?weeks=20` | Minutes per ISO week |
| GET | `/api/stats/projects?from&to` | Minutes per project, for the pie |
| GET | `/api/export.csv?from&to` | Streamed CSV |
| POST | `/api/alerts/check` | Runaway-timer check; called by GitHub Actions, secret-header auth |
| GET/PATCH | `/api/settings` | Time zone, daily goal, chart window, alert threshold |

Stats are computed in SQL (`date_trunc` in the home zone, grouped), not by pulling entries
into Node. At your data volume either works; the SQL version stays correct when a single
entry spans days, because it slices on the generated day boundaries.

Every handler starts with the same session check. Unauthenticated requests get 401, never a
redirect — the client handles the redirect, so a stale tab doesn't silently show an HTML
login page where JSON was expected.

`/api/alerts/check` is the one exception: a cron request has no session, so it authenticates
on a `x-cron-key` header compared against `CRON_SECRET` in constant time. It's the only
route reachable without a login, it accepts no parameters, and the most a leaked key
buys an attacker is the ability to make your own inbox email you.

---

## 7. Frontend structure

```
src/
├── app/
│   ├── layout.tsx              shell: nav, providers, running-timer bar
│   ├── page.tsx                week view
│   ├── backlog/page.tsx
│   ├── dashboard/page.tsx
│   ├── settings/page.tsx
│   └── api/…                   route handlers
├── components/
│   ├── week/
│   │   ├── WeekGrid.tsx        the scroll container + columns
│   │   ├── DayColumn.tsx       one day, positions its blocks
│   │   ├── EntryBlock.tsx      a drawn entry
│   │   ├── EntryPopover.tsx    edit form + trash icon (shared: click, drag, edit)
│   │   ├── NowLine.tsx         red current-time line
│   │   ├── DayTaskStrip.tsx    the expandable due-tasks menu under each weekday
│   │   └── useDragCreate.ts    pointer-event drag → time range
│   ├── timer/RunningBar.tsx    sticky bar: elapsed, project, stop button
│   ├── backlog/…
│   ├── dashboard/…
│   └── ui/                     Radix wrappers, buttons, inputs
├── domain/                     pure logic (see §5) — the tested core
│   ├── time.ts                 rounding, zone conversion, DST-safe day bounds
│   ├── layout.ts               entry → {top, height} and multi-day splitting
│   ├── overlap.ts              conflict detection
│   └── csv.ts                  row serialisation
├── server/
│   ├── db.ts                   Prisma singleton
│   ├── auth.ts                 Auth.js config
│   └── services/               entries, projects, tasks, stats — all DB access
└── lib/                        query client, fetch wrapper, zod schemas
```

The layering rule: components never import Prisma, services never import React, and
`domain/` imports neither. It keeps the interesting logic runnable in a test file without
booting a database or a browser.

---

## 8. The week grid

**Layout.** A CSS grid, seven columns wide, inside a vertically scrolling container. The
background is 24 hour-rows drawn with a repeating gradient (a lighter half-hour rule inside
each). Entries are absolutely positioned within their day column.

**The hour height is measured, not fixed.** The scroll container reports its own height and
the grid zooms so the nine-hour working day (09:00–18:00) fits without scrolling, clamped to
34–96px per hour — below that a 15-minute block stops being clickable, above it the zoom
buys nothing on a tall screen. A fixed 72px meant the working day fitted on the author's
monitor and nowhere else. The scale is threaded down as `pxPerMinute`, so hit-testing,
drag maths and the now-line all derive from the same number rather than from a constant that
could drift out of step with what is drawn.

Blocks are **positioned by wall-clock minutes** (09:30 is always 570) while durations and
totals use **real elapsed minutes**. Those differ only on DST days, and the split is
deliberate: it keeps the hour gutter aligned with every column 365 days a year, while a
25-hour Sunday still adds up to 25 hours in the totals.

On mount the container scrolls to 9am at the top of the viewport; the full 00:00–24:00 range
stays reachable by scrolling, per your requirement. The scroll position persists across week
navigation so paging weeks doesn't jump you back to 9am each time. A later zoom change —
only a window resize can cause one — keeps whatever minute is at the top of the viewport
instead of snapping back to 9am.

The header puts the week between the arrows that change it: `W31` with its date range
underneath, both in the one calendar format the UI uses (`Jul-27 – Aug-2`).

**Interactions.**

- **Click empty space** → starts a live timer at the minute you clicked and opens
  `EntryPopover` anchored at the click with the description focused. The block appears
  immediately (optimistic), then reconciles with the server response. It keeps running,
  and shows in the timer strip, until you stop it or type an end time.

  Three things have to hold for a click to mean "I am doing this now": the column is
  today, the minute is at or before now, and nothing is logged later that day, since a
  timer with no end would run straight through it. When any of them fails the click logs a
  `DEFAULT_BLOCK_MINUTES` block instead, clipped to whatever comes next. The rule is
  `intentFromClick` in `domain/layout.ts`, tested there rather than in the component.
- **Drag empty space** → a ghost block follows the pointer, snapping to 5-minute
  increments (hold `Alt` for 1-minute precision). On release it creates a *completed*
  entry over that exact range and opens the same popover.
- **Click an existing entry** → the same popover in edit mode: description, project, task,
  tags, start/end time inputs, and the trash icon in its corner. Delete is optimistic with
  an undo toast rather than a confirm dialog — a mis-click costs one click to reverse, and
  a confirm dialog on every delete gets clicked through blindly within a week.

**Two fields in the popover earn their own machinery.**

The **description** completes against what you have logged before, most-used first
(`/api/entries/descriptions` → `domain/suggest.ts`). The whole history is a few hundred
short strings, so it is fetched once and matched in the browser; a request per keystroke
would put the dropdown behind the keyboard. The list opens on typing rather than on focus,
because opening the editor on an existing entry should show you the entry and not a menu
over the dial. Radix listens for `Escape` on the document in the capture phase, so
`EntryBlock` suppresses its own dismissal while the list is up. Otherwise the first
`Escape` throws away the edit instead of closing the dropdown.

The **start and end** are text boxes, not `input type="time"`. The native control is
segmented, draws an arrow cursor, and takes more than one click to put the caret anywhere
useful. `TimeInput` inserts the colon for you (`0930` and `930` both reach 09:30, via
`maskClockInput`), keeps arrow-key nudging, and reverts anything unparseable on blur.
`9:3` was as likely 9:03 as 9:30, and guessing edits your data. It stays silent when there
is nothing to fix, because any reported change re-derives which day the end falls on, and
doing that for a field you only clicked into would quietly take a day off a multi-day
entry. An **empty end** means the entry has no end: a running one keeps running and shows
in the timer strip, and typing a time there is how you stop it at a minute of your choice.
- **Drag an entry's edges** → resize; **drag its body** → move. Both snap to 5 minutes and
  both are rejected on overlap with the conflicting entry flashed.

**Nothing in the grid waits for the server to draw.** A drag renders from local state, so
the block tracks the pointer at frame rate; on release the mutation writes the expected
result into the query cache before the request goes out. A block that snapped back to its
old position until the PATCH returned would read as lag however fast the server answered.
The preview is clamped so it can only ever show a shape the server would accept, and a
rejected edit — an overlap, usually — rolls back and says why. The refetch in `onSettled`
remains the source of truth: it is what applies the minute rounding, the one-minute minimum,
and the clip of a stopped timer against the entry after it.

Everything routes through one `EntryPopover` component, so the create and edit paths can't
drift apart.

**Now line.** A red line across today's column, positioned by wall-clock minutes in the home
zone — so it tracks the zone the entries are drawn in, not the zone the browser is in —
updated on a 30s interval.

**Week navigation.** Previous/next/today, plus `←`/`→` keys. The visible week is a URL
param (`/?week=2026-W31`), so a reload or a shared link lands on the same week.

**Multi-day entries** draw as separate blocks per day with a small arrow at the cut edge,
and hovering one highlights the others.

---

## 9. Backlog tab

A list of `Task` rows split into two sections — **work-related** and **study** — and grouped
by project within each. Each row: checkbox, name, project chip, optional due date, total time
logged against it, a ⇄ button that moves it to the other section, and a ▶ Start button that
opens a running entry linked to that task with the description pre-filled from the task name.

**Why the section is on the task and not on the project.** The project is the reporting
dimension — it is what colours a block and what the dashboard donut slices by. Making the
split a property of the project would have collapsed that to two slices, and would have
stopped a project holding both a work task and a study task. The section is a second, coarser
axis over the same projects. Both sections always render, empty or not, so it is clear where
a new task will land; a section with nothing in it says so rather than vanishing.

Completing a task sets `status = DONE` and `completedAt`; done tasks collapse into a
"Completed" section rather than disappearing, so the dashboard can still attribute their
hours.

**The weekday expander.** Under each weekday header in the week grid, a `Collapsible`
showing tasks whose `dueDate` is that day, as compact chips with the same ▶ Start button.
Collapsed by default with a count badge (`3 due`); the expanded/collapsed state persists in
`localStorage`. The header shows nothing at all on days with no due tasks, so the grid
doesn't grow a row of empty furniture.

---

## 10. Dashboard tab

Three panels, each with its own date-range control, defaulting as you described:

1. **Hours per day** — bar chart, current week, with a dashed reference line at the daily
   goal and a `+1.2h / −0.5h` delta under each bar.
2. **Hours per week** — bar chart over the last N weeks (N is a control, default 20, stored
   in settings) with a reference line at `goal × 5` and a rolling average line.
3. **Time by project** — pie/donut over the selected range, project colours matching the
   grid, with a legend showing hours and percentage. Tasks roll up into their project;
   hovering a slice can expand a per-task breakdown.

Plus a summary strip: total hours, daily average, longest day, most-tracked project.

Charts follow one shared configuration — same fonts, same grid weight, same colour tokens —
so the three panels read as one instrument rather than three library defaults.

**Colour is validated, not chosen.** Project colours come from a fixed eight-hue
categorical palette in a fixed order, checked with a palette validator against this app's
own surfaces rather than by eye:

| | worst adjacent CVD ΔE | worst normal-vision ΔE | contrast |
|---|---|---|---|
| light on `#ffffff` | 9.1 | 19.6 | 3 hues under 3:1 — relief shipped |
| dark on `#111827` | 8.4 | 19.3 | all ≥ 3:1 |

A stored project colour is always the light hex; `darkVariant()` maps it to the step chosen
for the dark surface, because the same hexes fail the dark lightness band. My first
hand-picked palette failed four checks outright (two hues 0.3 ΔE apart under protanopia),
which is exactly why this is computed rather than eyeballed.

Identity is never carried by colour alone: the donut's legend lists every project with
hours and share, each panel has a "Show the numbers" table, and beyond seven projects the
tail folds into "Other" rather than inventing hues the palette hasn't validated.

---

## 11. CSV export

`GET /api/export.csv?from=…&to=…` streams Toggl Detailed-report columns:

```
Project,Task,Description,Start date,Start time,End date,End time,Duration,Tags
Others,,Email triage,2026-07-27,09:12,2026-07-27,09:48,00:36:00,"admin"
```

Dates and times are rendered in the home time zone; `Duration` is `HH:MM:SS` with
uncapped hours, which is Toggl's own format (seconds are always `00` — the minimum unit
here is a minute). Multi-day
entries export as **one row** with different start and end dates — that's what Toggl does,
and splitting them would misrepresent the entry. The range picker sits in the week view
header and defaults to the visible week. Streamed rather than buffered so a multi-year
export doesn't build the whole file in a serverless function's memory.

---

## 12. Runaway timer alert

No autostop, no worker service. A scheduled HTTP call tells the app to look for a timer
you've forgotten, and the app emails you once if it finds one.

**The check** is an ordinary route handler:

```ts
// POST /api/alerts/check
if (!timingSafeEqual(req.headers.get('x-cron-key'), process.env.CRON_SECRET))
  return new Response(null, { status: 401 });

const settings = await getSettings();
const cutoff   = subHours(new Date(), settings.alertAfterHours);

const stale = await db.timeEntry.findFirst({
  where: { endedAt: null, startedAt: { lt: cutoff }, alertSentAt: null },
  include: { project: true, task: true },
});

if (stale) {
  await sendRunawayTimerEmail(stale, settings.timezone);
  await db.timeEntry.update({
    where: { id: stale.id },
    data:  { alertSentAt: new Date() },
  });
}
await touchAlertHeartbeat();          // Settings.lastAlertCheckAt = now
```

`findFirst` rather than `findMany` is sufficient: the partial unique index from §4 means at
most one entry is running at any moment, so "any task over 12h" is always zero or one row.

**`alertSentAt` is what stops it becoming a nuisance.** Without it, a timer left running
over a weekend generates an email every 15 minutes — roughly 250 of them. With it, one
entry produces exactly one email, ever. Stopping the entry and starting a new one is a new
row, so the next runaway gets its own alert.

**The schedule** is a GitHub Actions workflow, the only scheduled component in the system:

```yaml
# .github/workflows/alert.yml
on:
  schedule: [{ cron: '*/15 * * * *' }]
  workflow_dispatch:            # so you can fire it by hand to test
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS -X POST "${{ secrets.APP_URL }}/api/alerts/check" \
               -H "x-cron-key: ${{ secrets.CRON_SECRET }}" --fail
```

GitHub delays scheduled workflows under load, so the email lands somewhere between 12h00
and about 12h20 after the timer started. For a threshold whose whole purpose is "you
clearly forgot about this", that slack is irrelevant — and unlike the autostop design it
replaces, nothing here writes a `now`-derived value into your data. A late run sends a late
email; it cannot produce a wrong timestamp.

**The email** is plain text: description, project, task, start time in your home zone,
elapsed hours, and a link to the app. Sent through Resend to your own account address, so
there is no domain to buy or DNS to configure.

**One caveat worth knowing up front:** GitHub disables scheduled workflows in repositories
with no commit activity for 60 days. On a personal project that goes quiet after launch,
that will eventually happen silently. Two mitigations, both cheap:

1. The check route stamps `Settings.lastAlertCheckAt`, and the app shows a small banner if
   that heartbeat is more than 24 hours old — so a dead scheduler surfaces in the UI rather
   than being discovered the day you need it.
2. `workflow_dispatch` is enabled, so you can re-arm or test it with one click.

If the 60-day expiry turns out to bite in practice, the fallback with the fewest moving
parts is a free external pinger (cron-job.org and similar) hitting the same route with the
same header — the app side doesn't change at all.

---

## 13. Mobile & PWA

Seven columns don't fit on a 375px screen — anything that tries is unusable. So mobile is a
different layout over the same data:

- **Single-day column** with a horizontal week strip at the top (day initials + total
  hours), swipe or tap to change day.
- **A FAB** to start a timer, since precise dragging on a touch grid is unpleasant.
- **Larger hit targets** on entry blocks; the popover becomes a bottom sheet.
- Backlog and dashboard are already vertical lists and charts; they reflow with no
  structural change.

The breakpoint is at `md` (768px): below it, one day; above it, the full week.

**PWA.** A web manifest (name, icons, `display: standalone`, theme colour) plus a minimal
hand-written service worker that caches the app shell and static assets, and always goes to
the network for `/api/*`. No offline writes — that was the decision, and a service worker
that pretends to cache API responses is how you end up staring at yesterday's timer. The
running timer refetches on `visibilitychange`, on window focus, and every 30 seconds, so
picking up the phone shows the current state within a second.

---

## 14. Testing

Vitest against `src/domain/`, where the genuinely error-prone logic lives:

- rounding to minutes, including the sub-minute start/stop case
- `splitAcrossDays` across midnight, across a DST spring-forward (23h day) and
  fall-back (25h day), and for entries spanning three or more days
- overlap detection: abutting entries (must pass), 1-minute overlaps (must fail),
  an edit that collides with itself (must pass)
- layout maths: entry → top/height, and the inverse for drag-create
- CSV row serialisation, including a multi-day entry and one with quoted tags
- the alert predicate: 11h59 doesn't fire, 12h01 does, a closed entry never fires, and an
  entry with `alertSentAt` already set never fires a second time

Two verification scripts cover what unit tests structurally cannot:

- **`npm run check:db`** (`scripts/integration-check.ts`) — runs against a throwaway
  Postgres. Proves the hand-written migrations apply, the exclusion constraint and partial
  unique index actually reject raw inserts, the start-timer transaction produces exactly
  abutting entries, project deletion reassigns instead of destroying, and the raw stats SQL
  splits a multi-day entry correctly (and measures a 25-hour Sunday as 1500 minutes).
  38 checks.
- **`npm run check:http`** (`scripts/http-smoke.ts`) — mints a valid Auth.js session cookie
  and drives the real HTTP surface: pages render for a signed-in user, the API answers 401
  as JSON rather than redirecting, an overlapping POST comes back 409 with the conflict
  named, and the CSV streams with the right content type. 19 checks.

Both were worth writing: the first caught a migration bug that made every project
undeletable, the second caught an auth misconfiguration that made the app unrunnable
anywhere except Vercel. Neither was visible to `tsc` or Vitest.

No E2E browser suite for v1 — for a single-user app it's more maintenance than it returns.
Client-side interaction (drag-to-create, resize, popovers) is therefore the one layer
covered by neither, and worth exercising by hand after milestone 4.

---

## 15. Environment & setup

```bash
# Vercel
DATABASE_URL=              # Railway Postgres, pooled connection string
AUTH_SECRET=               # openssl rand -base64 32
AUTH_EMAIL=                # the one login email
AUTH_PASSWORD=             # the one login password
ALLOWED_EMAIL=dvallslanaquera@gmail.com    # runaway-timer alert recipient
NEXTAUTH_URL=              # production URL
RESEND_API_KEY=
CRON_SECRET=               # openssl rand -hex 32

# GitHub repository secrets (for the scheduled workflow)
APP_URL=                   # https://…vercel.app
CRON_SECRET=               # the same value as above
```

The Credentials provider's `authorize` compares the submitted email (case-insensitive) and
password against `AUTH_EMAIL` and `AUTH_PASSWORD`, and fails closed if either is unset, so
a stranger who finds the login page gets a rejection rather than an account. The password is
compared in constant time so a wrong guess leaks no timing signal. Session strategy is JWT
— no adapter, no user tables, nothing to store.

The config also sets `trustHost: true`. Auth.js only auto-trusts the request host on
recognised platforms; without it, `next start` and local dev fail with `UntrustedHost` even
with valid credentials, and the app would run on Vercel and nowhere else.

Setup order: Railway Postgres → `prisma migrate deploy` + seed → Vercel project with env
vars (set `AUTH_EMAIL` and `AUTH_PASSWORD` to the login you want) → Resend account with
your address verified → the two GitHub secrets, then trigger the workflow by hand once to
prove the whole path works.

---

## 16. Build order

Each step ends somewhere usable, so you can react to the real thing rather than to this
document.

| # | Milestone | You can… |
|---|---|---|
| 1 | Scaffold, DB, auth, migrations, seed | Log in, see an empty week |
| 2 | Week grid rendering + entries API | See entries; navigate weeks |
| 3 | Timer: start/stop, running bar, click-to-start | Track time for real — **usable daily from here** |
| 4 | Popover: edit, delete, drag-create, drag-resize | Full manual control of the grid |
| 5 | Projects: CRUD, colours, archive, delete+reassign | Organise the data |
| 6 | Backlog: tasks, due dates, start-from-task, weekday strip | Plan work, not just record it |
| 7 | Alert route, Resend email, GitHub Actions schedule | Stop worrying about forgotten timers |
| 8 | Dashboard: three charts, goal lines, summary strip | See the patterns |
| 9 | CSV export | Get the data out |
| 10 | Mobile layout + PWA polish | Track from the phone |

Milestone 3 is the one that matters — after it the app replaces Toggl for daily use, and
everything after is refinement you can prioritise from experience.

---

## 17. Assumptions I made without asking

Flag any of these and I'll change them before writing code:

1. **Home time zone is `Asia/Tokyo`**, editable in settings. It was `Europe/Madrid` until a
   migration moved both the column default and the single existing row.
2. **Week starts Monday, ISO week numbers.** You said Monday–Sunday, so this follows.
3. **Tags are free-form and created inline** as you type in the entry popover, rather than
   managed in a separate admin screen.
4. **Deleting an entry is undo-toast, not a confirm dialog.** Fewer clicks in the common
   case, still recoverable.
5. **Drag snapping is 5 minutes** (`Alt` for 1-minute). Minute-precision dragging on a
   64px-per-hour grid means a 1px pointer error changes the value.
6. **Dark mode follows the system**, no manual toggle in v1.
7. **The description field, not the task, is the primary label** on a grid block — task
   link is optional metadata. An entry started from the backlog copies the task name in.
8. **No idle detection or time rounding rules** (e.g. "round everything to 15 minutes").
   Easy to add later; not in v1.
9. **Archived projects stay visible in the dashboard's historical ranges** — they're hidden
   from pickers, not from history.
10. **The 12-hour threshold measures one running entry's elapsed time**, not a task's
    cumulative logged time. A task you've spent 30 hours on over a month never emails you;
    a single timer left running since Friday does.
11. **One email per runaway entry, ever** — no reminders, no escalation. The threshold is
    a setting, so 12h is a default rather than a constant.

---

## 18. Deliberately out of scope

Not building these unless you say otherwise: multi-user or sharing, Toggl import,
billable rates and invoicing, native mobile apps, browser-extension or IDE integrations,
Pomodoro timers, calendar (Google/Outlook) sync, recurring tasks, notifications beyond the
runaway-timer email, and public REST API tokens.

---

**Next step:** tell me what's wrong, and what in §17 you want changed. Once this reads
right, I'll start at milestone 1.
