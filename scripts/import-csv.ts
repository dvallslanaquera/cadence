/**
 * Imports a time-tracking CSV into Cadence.
 *
 *   npm run import:csv -- imports/your-export.csv
 *   npm run import:csv -- imports/your-export.csv --on-conflict=truncate
 *   npm run import:csv -- imports/your-export.csv --write
 *
 * DRY RUN BY DEFAULT: without --write it reads the file, resolves everything,
 * prints the report and touches nothing. Read the report before adding --write.
 *
 * Flags:
 *   --write                 actually insert (default: dry run)
 *   --on-conflict=skip      drop the later of two overlapping rows (default)
 *   --on-conflict=truncate  shorten the earlier row to where the later begins
 *   --tz=Europe/Madrid      zone the CSV's wall-clock times are in
 *                           (default: the timezone in Settings)
 *   --date-format=dmy|mdy   only needed if the file uses ambiguous slash dates
 *
 * Existing entries are never modified. An imported row that collides with
 * something already in the database is reported and skipped — re-running the
 * same file is therefore safe, and imports nothing the second time.
 *
 * See ARCHITECTURE.md §4 for why overlaps cannot simply be inserted.
 */
import { readFileSync } from "node:fs";
import { db } from "../src/server/db";
import {
  detectDateOrder,
  mapRecords,
  parseCsv,
  resolveOverlaps,
  toRecords,
  totalMinutes,
  type ConflictPolicy,
  type DateOrder,
  type ImportCandidate,
} from "../src/domain/csv-import";
import { nextProjectColor } from "../src/lib/constants";
import { intervalsOverlap } from "../src/domain/overlap";
import { formatClock, formatDateISO } from "../src/domain/time";

const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--"));
const write = args.includes("--write");

const flag = (name: string) =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");

const policy = (flag("on-conflict") ?? "skip") as ConflictPolicy;
const dateFormatFlag = flag("date-format") as DateOrder | undefined;
const tzFlag = flag("tz");

const hours = (minutes: number) => `${(minutes / 60).toFixed(1)}h`;

function bail(message: string): never {
  console.error(`\n  ${message}\n`);
  process.exit(1);
}

async function main() {
  if (!file) bail("Usage: npm run import:csv -- imports/your-export.csv [--write]");
  if (policy !== "skip" && policy !== "truncate") {
    bail(`--on-conflict must be "skip" or "truncate", got "${policy}"`);
  }

  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    bail(`Cannot read ${file}`);
  }

  const settings = await db.settings.findUnique({ where: { id: 1 } });
  if (!settings) bail('No Settings row — run `npm run db:seed` first');
  const tz = tzFlag ?? settings.timezone;

  const records = toRecords(parseCsv(text));
  if (records.length === 0) bail("That file has no data rows");

  // --- date format -------------------------------------------------------
  const detected = detectDateOrder(records.map((r) => r["start date"] ?? ""));
  if (detected === "ambiguous" && !dateFormatFlag) {
    bail(
      "This file uses slash dates that could be day-first or month-first.\n" +
        "  Re-run with --date-format=dmy or --date-format=mdy.",
    );
  }
  const order: DateOrder = dateFormatFlag ?? (detected === "ambiguous" ? "iso" : detected);

  // --- map ---------------------------------------------------------------
  const mapped = mapRecords(records, tz, order);
  if (mapped.missingColumns.length > 0) {
    bail(
      `That does not look like a CSV export — missing columns: ${mapped.missingColumns.join(", ")}\n` +
        "  Expected columns: Project, Task, Description, Start date, Start time, End date, End time, Duration, Tags.",
    );
  }

  const { entries: resolved, conflicts } = resolveOverlaps(mapped.candidates, policy);

  // --- collisions with data already in the database ----------------------
  const first = resolved[0]?.startedAt;
  const last = resolved.reduce<Date | null>(
    (max, e) => (!max || e.endedAt > max ? e.endedAt : max),
    null,
  );

  const existing =
    first && last
      ? await db.timeEntry.findMany({
          where: { startedAt: { lt: last }, OR: [{ endedAt: { gt: first } }, { endedAt: null }] },
          select: { startedAt: true, endedAt: true, description: true },
        })
      : [];

  const now = new Date();
  const clashed: ImportCandidate[] = [];
  const importable = resolved.filter((candidate) => {
    const hit = existing.some((row) =>
      intervalsOverlap(
        candidate.startedAt,
        candidate.endedAt,
        row.startedAt,
        row.endedAt ?? now,
      ),
    );
    if (hit) clashed.push(candidate);
    return !hit;
  });

  // --- report ------------------------------------------------------------
  const projectNames = [...new Set(importable.map((e) => e.projectName).filter(Boolean))] as string[];
  const tagNames = [...new Set(importable.flatMap((e) => e.tags))];
  const existingProjects = await db.project.findMany({ select: { name: true, color: true } });
  const known = new Set(existingProjects.map((p) => p.name));
  const newProjects = projectNames.filter((name) => !known.has(name));

  const span =
    importable.length > 0
      ? `${formatDateISO(importable[0].startedAt, tz)} → ${formatDateISO(importable[importable.length - 1].endedAt, tz)}`
      : "—";

  console.log(`\n  ${write ? "IMPORT" : "DRY RUN"}  ${file}`);
  console.log(`  timezone ${tz}   dates ${order}   on-conflict ${policy}\n`);
  console.log(`  rows in file        ${records.length}`);
  console.log(`  importable          ${importable.length}  (${hours(totalMinutes(importable))}, ${span})`);

  if (mapped.rejected.length > 0) {
    const byReason = new Map<string, number>();
    for (const row of mapped.rejected) {
      byReason.set(row.reason, (byReason.get(row.reason) ?? 0) + 1);
    }
    console.log(`  rejected            ${mapped.rejected.length}`);
    for (const [reason, count] of byReason) console.log(`      ${reason}: ${count}`);
    for (const row of mapped.rejected.slice(0, 5)) {
      console.log(`      line ${row.line}: ${row.reason} — ${row.detail}`);
    }
    if (mapped.rejected.length > 5) console.log(`      … and ${mapped.rejected.length - 5} more`);
  }

  if (conflicts.length > 0) {
    const lost = conflicts.reduce((sum, c) => sum + c.lostMinutes, 0);
    console.log(`  overlaps in file    ${conflicts.length}  (${hours(lost)} affected)`);
    for (const conflict of conflicts.slice(0, 5)) {
      console.log(`      line ${conflict.line} vs ${conflict.againstLine}: ${conflict.action}, ${conflict.lostMinutes}m`);
    }
    if (conflicts.length > 5) console.log(`      … and ${conflicts.length - 5} more`);
  }

  if (clashed.length > 0) {
    console.log(`  clash with existing ${clashed.length}  (skipped — existing data is never modified)`);
    for (const entry of clashed.slice(0, 5)) {
      console.log(
        `      line ${entry.line}: ${formatDateISO(entry.startedAt, tz)} ${formatClock(entry.startedAt, tz)} ${entry.description}`,
      );
    }
    if (clashed.length > 5) console.log(`      … and ${clashed.length - 5} more`);
  }

  console.log(`\n  projects            ${projectNames.length} referenced, ${newProjects.length} new`);
  if (newProjects.length > 0) console.log(`      ${newProjects.join(", ")}`);
  console.log(`  tags                ${tagNames.length}`);

  if (!write) {
    console.log(`\n  Nothing was written. Re-run with --write to import.\n`);
    return;
  }
  if (importable.length === 0) {
    console.log(`\n  Nothing to import.\n`);
    return;
  }

  // --- write -------------------------------------------------------------
  const written = await db.$transaction(
    async (tx) => {
      const others = await tx.project.findFirst({ where: { isSystem: true } });
      if (!others) throw new Error('No "Others" project — run `npm run db:seed`');

      const used = existingProjects.map((p) => p.color);
      const projectIds = new Map<string, string>();
      for (const name of projectNames) {
        const project = await tx.project.upsert({
          where: { name },
          update: {},
          create: { name, color: nextProjectColor(used) },
        });
        used.push(project.color);
        projectIds.set(name, project.id);
      }

      const tagIds = new Map<string, string>();
      for (const name of tagNames) {
        const tag = await tx.tag.upsert({ where: { name }, update: {}, create: { name } });
        tagIds.set(name, tag.id);
      }

      // Task names are not unique, so they are resolved per project.
      const taskIds = new Map<string, string>();
      for (const entry of importable) {
        if (!entry.taskName) continue;
        const projectId = entry.projectName ? projectIds.get(entry.projectName)! : others.id;
        const key = `${projectId} ${entry.taskName}`;
        if (taskIds.has(key)) continue;
        const found = await tx.task.findFirst({
          where: { name: entry.taskName, projectId },
          select: { id: true },
        });
        const task =
          found ?? (await tx.task.create({ data: { name: entry.taskName, projectId } }));
        taskIds.set(key, task.id);
      }

      let count = 0;
      const chunkSize = 500;
      for (let i = 0; i < importable.length; i += chunkSize) {
        const chunk = importable.slice(i, i + chunkSize);
        const rows = await tx.timeEntry.createManyAndReturn({
          data: chunk.map((entry) => {
            const projectId = entry.projectName
              ? projectIds.get(entry.projectName)!
              : others.id;
            return {
              description: entry.description.slice(0, 500),
              projectId,
              taskId: entry.taskName
                ? (taskIds.get(`${projectId} ${entry.taskName}`) ?? null)
                : null,
              startedAt: entry.startedAt,
              endedAt: entry.endedAt,
            };
          }),
          select: { id: true },
        });

        const links = chunk.flatMap((entry, index) =>
          entry.tags
            .map((name) => tagIds.get(name))
            .filter((id): id is string => Boolean(id))
            .map((tagId) => ({ entryId: rows[index].id, tagId })),
        );
        if (links.length > 0) {
          await tx.tagsOnEntries.createMany({ data: links, skipDuplicates: true });
        }
        count += rows.length;
      }

      return count;
    },
    { timeout: 120_000, maxWait: 20_000 },
  );

  console.log(`\n  Imported ${written} entries.\n`);
}

main()
  .catch((error) => {
    console.error("\n  Import failed — nothing was committed.");
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
