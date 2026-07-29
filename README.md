# Cadence

A single-user, Toggl-style time tracker: log hours on a week grid, start timers
from a task backlog, and review the patterns on a dashboard.

The full design rationale — stack choices, data model, domain rules, the week
grid, the alert system — lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Configuration](#configuration)
- [Requirements](#requirements)
- [Tech Stack](#tech-stack)
- [Notes](#notes)
- [Testing](#testing)
- [License](#license)

## Features

- **Week grid:** Click empty space to start a live timer, drag to log a fixed
  block, hold `Alt` for minute precision. Drag a block to move it, its edges to
  resize.
- **Backlog-driven timers:** Start a running entry from any task with the
  description pre-filled; tasks due on a weekday surface right under that day in
  the grid.
- **Overlap-proof entries:** A Postgres exclusion constraint makes overlapping
  time entries impossible, not merely discouraged — the database enforces it, so
  two racing tabs cannot create a conflict.
- **Runaway-timer alerts:** A scheduled check emails you once when a running
  entry passes the threshold. Nothing is ever truncated; your data is always
  literally what the clock did.
- **Dashboard:** Hours per day and per week with goal reference lines, a project
  donut, and a summary strip. Colours are validated against the app's own
  surfaces, not eyeballed.

## Getting Started

```bash
git clone https://github.com/dvallslanaquera/cadence.git
cd cadence
npm install
cp .env.example .env          # fill in DATABASE_URL and the auth vars
npm run db:deploy             # apply migrations
npm run db:seed               # create the "Others" project + settings row
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a local database, start a Postgres 16 container (the second migration needs
the `btree_gist` extension, which the official image includes):

```bash
docker run -d --name cadence-db -e POSTGRES_PASSWORD=cadence -p 5432:5432 postgres:16
# DATABASE_URL="postgresql://postgres:cadence@localhost:5432/postgres"
```

## Environment Variables

Copy [`.env.example`](./.env.example) and fill it in.

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Postgres connection string, pooled | Yes |
| `AUTH_SECRET` | Session signing secret (`openssl rand -base64 32`) | Yes |
| `AUTH_GOOGLE_ID` | Google OAuth client ID | Yes |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret | Yes |
| `ALLOWED_EMAIL` | Login allowlist **and** the runaway-timer alert recipient | Yes |
| `RESEND_API_KEY` | Resend API key for alert email delivery | For alerts |
| `ALERT_FROM_EMAIL` | Verified Resend sender address | For alerts |
| `CRON_SECRET` | Shared secret for `/api/alerts/check`; also set as a GitHub repo secret | For alerts |

> [!IMPORTANT]
> `ALLOWED_EMAIL` fails closed: if it is unset, nobody can sign in.

## Configuration

Runtime settings live in the single `Settings` row, editable from the in-app
settings page.

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `timezone` | `string` | `"Asia/Tokyo"` | Home zone every date renders in |
| `dailyGoalHours` | `float` | `8` | Daily goal, drawn as a reference line |
| `weeklyChartWeeks` | `int` | `20` | Weeks shown on the weekly chart |
| `alertAfterHours` | `int` | `12` | Runaway-timer email threshold |

## Requirements

- Node.js 22+ (see `@types/node` in `package.json`)
- Postgres 16 with the `btree_gist` extension (Railway's Postgres and the
  official `postgres:16` image both have it)

## Tech Stack

- [Next.js 15](https://nextjs.org/) (App Router) — UI and API in one codebase
- [TypeScript](https://www.typescriptlang.org/) strict
- [Prisma](https://www.prisma.io/) over [Postgres 16](https://www.postgresql.org/)
- [Auth.js](https://authjs.dev/) with Google, locked to one email
- [TanStack Query](https://tanstack.com/query) for server state
- [Recharts](https://recharts.org/) for the dashboard
- [Tailwind CSS v4](https://tailwindcss.com/) for styling
- [Resend](https://resend.com/) for the alert email
- GitHub Actions as the only scheduler

## Notes

> [!NOTE]
> **Overlaps are impossible, not merely discouraged.** A Postgres exclusion
> constraint over `tstzrange(startedAt, endedAt, '[)')` rejects them. The service
> layer checks first so you get "Overlaps *Standup*, 09:00–09:15" instead of a
> constraint violation, but the database is what makes the rule true when two
> tabs race.

> [!NOTE]
> **Nothing truncates a timer.** A GitHub Actions schedule pings
> `/api/alerts/check` every 15 minutes; past the threshold you get exactly one
> email per entry, and the timer keeps running. `alertSentAt` is what stops a
> timer left running over a weekend from emailing you ~250 times.

> [!WARNING]
> **GitHub disables scheduled workflows after 60 days of repo inactivity.** The
> check route stamps a heartbeat and the UI warns if it goes stale for more than
> 24 hours, so a dead scheduler surfaces on screen rather than the day you
> needed it.

Time is stored as UTC `timestamptz` and rendered in the home zone from settings.
Blocks are positioned by wall-clock minutes so the hour gutter stays correct on
DST days, while durations and totals use real elapsed minutes — a 25-hour Sunday
adds up to 25 hours. Below 768px the week collapses to a single day with a week
strip.

## Testing

```bash
npm test
```

Vitest covers the domain layer — minute rounding, splitting entries across
midnight and both DST transitions, overlap detection, CSV serialisation, and the
alert threshold. It runs without a database or a browser.

Two scripts cover what unit tests cannot reach:

```bash
# Migrations, DB constraints and raw stats SQL, against a real Postgres.
# WARNING: truncates the database it points at.
docker run -d --name cadence-db -e POSTGRES_PASSWORD=cadence \
  -e POSTGRES_DB=cadence -p 55432:5432 postgres:16
export DATABASE_URL=postgresql://postgres:cadence@localhost:55432/cadence
npm run db:deploy && npm run db:seed
npm run check:db        # 38 checks

# The real HTTP surface, with a minted session cookie (no OAuth needed).
npm run build && npm start &          # same DATABASE_URL and AUTH_SECRET
SMOKE_BASE_URL=http://localhost:3000 npm run check:http   # 19 checks
```

> [!TIP]
> Both earned their keep. `check:db` caught a migration bug that made every
> project undeletable — a `DO INSTEAD NOTHING` rule makes Postgres reject
> `DELETE … RETURNING`, which is what Prisma emits. `check:http` caught an
> Auth.js `UntrustedHost` failure that would have made the app run on Vercel and
> nowhere else.

Client-side interaction — drag-to-create, resize, the popovers — is the one layer
no automated check covers. Exercise it by hand.

## License

[Apache-2.0](./LICENSE)