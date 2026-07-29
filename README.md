# Cadence

A single-user time tracker in the shape of Toggl: a week calendar you log time on, a
backlog of tasks you can start a timer from, and a dashboard.

---

## Stack

Next.js 15 (App Router) on Vercel · Postgres on Railway · Prisma · Auth.js with Google ·
TanStack Query · Recharts · Tailwind v4 · Resend for the runaway-timer email ·
GitHub Actions as the only scheduler.

## Local setup

```bash
npm install
cp .env.example .env          # then fill it in — see below
npm run db:deploy             # apply migrations
npm run db:seed               # create the "Others" project + settings row
npm run dev
```

Open http://localhost:3000.

You need a Postgres 16 database with the `btree_gist` extension available — the second
migration uses it for the no-overlapping-entries exclusion constraint. Railway's Postgres
has it; so does the official `postgres:16` Docker image:

```bash
docker run -d --name cadence-db -e POSTGRES_PASSWORD=cadence -p 5432:5432 postgres:16
# DATABASE_URL="postgresql://postgres:cadence@localhost:5432/postgres"
```

## Environment

| Variable | Where | What it's for |
|---|---|---|
| `DATABASE_URL` | Vercel | Railway Postgres, pooled connection string |
| `AUTH_SECRET` | Vercel | `openssl rand -base64 32` |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Vercel | Google OAuth client |
| `ALLOWED_EMAIL` | Vercel | Login allowlist **and** the alert recipient |
| `NEXTAUTH_URL` | Vercel | Production URL |
| `RESEND_API_KEY` | Vercel | Alert email delivery |
| `ALERT_FROM_EMAIL` | Vercel | Verified Resend sender |
| `CRON_SECRET` | Vercel **and** GitHub | Shared secret for `/api/alerts/check` |
| `APP_URL` | GitHub | Your deployed URL, for the workflow |

`ALLOWED_EMAIL` fails closed: if it is unset, nobody can sign in.

## Deploying

1. **Railway**: create a Postgres instance. Copy the pooled connection string.
2. **Migrate**: `DATABASE_URL=… npm run db:deploy && DATABASE_URL=… npm run db:seed`.
   Migrations are never run from a Vercel build; a bad deploy must not be able to mutate
   the database.
3. **Google OAuth**: create credentials with
   `https://<your-app>/api/auth/callback/google` as the redirect URI.
4. **Vercel**: import the repo, set the env vars above, deploy.
5. **Resend**: create an account and verify your address. Without a custom domain,
   Resend can send to your own account address, which is the only recipient here.
6. **GitHub**: add `APP_URL` and `CRON_SECRET` as repository secrets, then run the
   "Runaway timer check" workflow once by hand to prove the whole path works.

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | `prisma generate` + production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest over the domain layer |
| `npm run check:db` | Integration check against a real Postgres |
| `npm run check:http` | HTTP smoke test against a running server |
| `npm run db:deploy` | Apply migrations |
| `npm run db:seed` | Seed "Others" + settings |
| `npm run db:studio` | Prisma Studio |

## Things worth knowing

**Overlaps are impossible, not merely discouraged.** A Postgres exclusion constraint over
`tstzrange(startedAt, endedAt, '[)')` rejects them. The service layer checks first so you
get "Overlaps *Standup*, 09:00–09:15" instead of a constraint violation, but the database
is what makes the rule true when two tabs race.

**Nothing truncates a timer.** A GitHub Actions schedule pings
`/api/alerts/check` every 15 minutes; past the threshold (default 12h) you get exactly one
email per entry, and the timer keeps running. `alertSentAt` is what stops a timer left
running over a weekend from emailing you ~250 times.

**GitHub disables scheduled workflows after 60 days of repo inactivity.** The check route
stamps a heartbeat and the UI shows a warning if it goes stale for more than 24 hours, so
a dead scheduler surfaces on screen rather than the day you needed it.

**The grid.** Click empty space to start a timer now; drag to log a fixed block; hold Alt
while dragging for minute precision. Drag a block's body to move it, its edges to resize.
Drags and start/stop land on screen immediately and reconcile with the server afterwards, so
a slow round trip never shows up as a laggy block. The grid measures its own viewport and
zooms so 09:00–18:00 fits without scrolling; the rest of the day is a scroll away. Below
768px the week collapses to a single day with a week strip, because seven columns at 375px
is unusable.

## Tests

```bash
npm test
```

Vitest covers the domain layer: minute rounding, splitting entries across midnight and
across both DST transitions, overlap detection (abutting passes, one-minute overlaps fail,
self-edits pass), CSV serialisation, and the alert threshold. That is where the logic that
can actually be wrong lives; it runs without a database or a browser. 48 tests.

Two further scripts cover what unit tests cannot reach.

```bash
# 1. Migrations, DB constraints and the raw stats SQL, against a real Postgres.
#    WARNING: truncates the database it points at.
docker run -d --name cadence-db -e POSTGRES_PASSWORD=cadence \
  -e POSTGRES_DB=cadence -p 55432:5432 postgres:16
export DATABASE_URL=postgresql://postgres:cadence@localhost:55432/cadence
npm run db:deploy && npm run db:seed
npm run check:db        # 38 checks

# 2. The real HTTP surface, with a minted session cookie (no OAuth needed).
npm run build && npm start &          # same DATABASE_URL and AUTH_SECRET
SMOKE_BASE_URL=http://localhost:3000 npm run check:http   # 19 checks
```

Both earned their keep. `check:db` caught a migration bug that made every project
undeletable:  a `DO INSTEAD NOTHING` rule makes Postgres reject `DELETE … RETURNING`,
which is what Prisma emits. `check:http` caught an Auth.js `UntrustedHost` failure that
would have made the app run on Vercel and nowhere else. Neither was visible to `tsc` or
Vitest.

Client-side interaction (drag-to-create, resize, the popovers, etc.) is the one layer no
automated check covers. Exercise it by hand.
