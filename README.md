<div align="center">
  <img src="public/icon.svg" width="88" height="88" alt="Cadence" />
</div>

# Cadence

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![Postgres](https://img.shields.io/badge/Postgres-16-336791)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2d3748)](https://www.prisma.io/)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue)](./LICENSE)

A single-user time tracker. You log hours on a week grid, start timers from a
task backlog, and read the patterns off a dashboard.

Stack choices, the data model, domain rules, and the alert system are
documented in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Table of Contents

- [Features](#features)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Configuration](#configuration)
- [Requirements](#requirements)
- [Tech Stack](#tech-stack)
- [Notes](#notes)
- [Testing](#testing)

## Features

- Week grid: click empty space to start a live timer, drag to log a fixed
  block, hold `Alt` for minute precision. Drag a block to move it, drag its
  edges to resize.
- Backlog timers: start a running entry from any task with the description
  prefilled. Tasks due on a weekday appear under that day in the grid.
- Overlap-proof entries: a Postgres exclusion constraint rejects overlapping
  entries at the database, so two racing tabs cannot create a conflict.
- Runaway-timer alerts: a scheduled check emails you once when a running entry
  passes the threshold. Nothing truncates a timer; your data stays literally
  what the clock did.
- Dashboard: hours per day and per week with goal reference lines, a project
  donut, and a summary strip. Project colours are validated against the app's
  own surfaces with a palette validator.

## Getting Started

```bash
git clone https://github.com/dvallslanaquera/cadence.git
cd cadence
npm install
cp .env.example .env          # fill in DATABASE_URL and the auth vars
npm run db:deploy             # apply migrations
npm run db:seed               # create the Others project and a settings row
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a local database, start a Postgres 16 container. The second migration needs
the `btree_gist` extension, which the official image ships:

```bash
docker run -d --name cadence-db -e POSTGRES_PASSWORD=cadence -p 5432:5432 postgres:16
# DATABASE_URL="postgresql://postgres:cadence@localhost:5432/postgres"
```

## Environment Variables

Copy [`.env.example`](./.env.example) and fill it in.

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Postgres connection string, pooled | Yes |
| `AUTH_SECRET` | Session signing secret, `openssl rand -base64 32` | Yes |
| `AUTH_EMAIL` | The one email the login accepts | Yes |
| `AUTH_PASSWORD` | The one password the login accepts | Yes |
| `ALLOWED_EMAIL` | The runaway-timer alert recipient | For alerts |
| `RESEND_API_KEY` | Resend API key for alert email delivery | For alerts |
| `ALERT_FROM_EMAIL` | Verified Resend sender address | For alerts |
| `CRON_SECRET` | Shared secret for `/api/alerts/check`, also set as a GitHub repo secret | For alerts |

> [!IMPORTANT]
> The login fails closed. If `AUTH_EMAIL` or `AUTH_PASSWORD` is unset, nobody can sign in.

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

- Node.js 22 or newer (see `@types/node` in `package.json`)
- Postgres 16 with the `btree_gist` extension. Railway's Postgres and the
  official `postgres:16` image both ship it.

## Tech Stack

- [Next.js 15](https://nextjs.org/) with the App Router, UI and API in one
  codebase
- [TypeScript](https://www.typescriptlang.org/) in strict mode
- [Prisma 6](https://www.prisma.io/) over [Postgres 16](https://www.postgresql.org/)
- [Auth.js](https://authjs.dev/) with a Credentials provider, one email and password in env
- [TanStack Query](https://tanstack.com/query) for server state
- [Recharts](https://recharts.org/) for the dashboard charts
- [Tailwind CSS v4](https://tailwindcss.com/) for styling
- [Resend](https://resend.com/) for the alert email
- GitHub Actions as the only scheduler

## Notes

> [!NOTE]
> A Postgres exclusion constraint over `tstzrange(startedAt, endedAt, '[)')`
> rejects overlapping entries. The service layer checks first so the message
> reads "Overlaps Standup, 09:00 to 09:15" instead of a constraint error, but
> the database is what holds the rule when two tabs race.

> [!NOTE]
> Nothing truncates a timer. A GitHub Actions schedule pings
> `/api/alerts/check` every 15 minutes, and past the threshold you get one
> email per entry while the timer keeps running. `alertSentAt` is what stops a
> timer left on over a weekend from emailing you about 250 times.

> [!WARNING]
> GitHub disables scheduled workflows after 60 days of repo inactivity. The
> check route stamps a heartbeat, and the UI warns if it goes stale for more
> than 24 hours, so a dead scheduler surfaces on screen instead of on the day
> you needed it.

Time is stored as UTC `timestamptz` and rendered in the home zone from
settings. Blocks are positioned by wall-clock minutes so the hour gutter stays
correct on DST days, while durations and totals use real elapsed minutes. A
25-hour Sunday adds up to 25 hours. Below 768px the week collapses to a single
day with a week strip.

## Testing

```bash
npm test
```

Vitest covers the domain layer: minute rounding, splitting entries across
midnight and both DST transitions, overlap detection, CSV serialisation, and
the alert threshold. It runs without a database or a browser.

Two scripts cover what unit tests cannot reach:

```bash
# Migrations, DB constraints, and raw stats SQL, against a real Postgres.
# WARNING: truncates the database it points at.
docker run -d --name cadence-db -e POSTGRES_PASSWORD=cadence \
  -e POSTGRES_DB=cadence -p 55432:5432 postgres:16
export DATABASE_URL=postgresql://postgres:cadence@localhost:55432/cadence
npm run db:deploy && npm run db:seed
npm run check:db        # 38 checks

# The real HTTP surface, with a minted session cookie and no login round-trip.
npm run build && npm start &          # same DATABASE_URL and AUTH_SECRET
SMOKE_BASE_URL=http://localhost:3000 npm run check:http   # 19 checks
```

> [!TIP]
> Both scripts earned their keep. `check:db` caught a migration bug that made
> every project undeletable. A `DO INSTEAD NOTHING` rule makes Postgres reject
> `DELETE ... RETURNING`, which is what Prisma emits. `check:http` caught an
> Auth.js `UntrustedHost` failure that would have confined the app to Vercel
> and nowhere else. Neither was visible to `tsc` or Vitest.

No automated check covers drag-to-create, resize, or the popovers. Exercise
them by hand.