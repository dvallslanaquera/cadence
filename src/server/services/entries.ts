import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { ApiError } from "@/server/api";
import { findConflicts, validateEntryShape } from "@/domain/overlap";
import { addMinutes, formatClock, roundToMinute } from "@/domain/time";
import { entryCreateSchema, entryUpdateSchema, timerStartSchema } from "@/lib/schemas";
import type { DescriptionSuggestion } from "@/lib/types";

const entryInclude = {
  project: { select: { id: true, name: true, color: true } },
  task: { select: { id: true, name: true } },
  tags: { select: { tag: { select: { name: true } } } },
} satisfies Prisma.TimeEntryInclude;

type EntryRow = Prisma.TimeEntryGetPayload<{ include: typeof entryInclude }>;

export interface EntryDto {
  id: string;
  description: string;
  startedAt: string;
  endedAt: string | null;
  alertSentAt: string | null;
  project: { id: string; name: string; color: string };
  task: { id: string; name: string } | null;
  tags: string[];
}

export function toEntryDto(row: EntryRow): EntryDto {
  return {
    id: row.id,
    description: row.description,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt ? row.endedAt.toISOString() : null,
    alertSentAt: row.alertSentAt ? row.alertSentAt.toISOString() : null,
    project: row.project,
    task: row.task,
    tags: row.tags.map((link) => link.tag.name),
  };
}

type Tx = Prisma.TransactionClient;

async function systemProjectId(tx: Tx | typeof db): Promise<string> {
  const project = await tx.project.findFirst({ where: { isSystem: true } });
  if (!project) {
    throw new ApiError(500, 'No "Others" project. Run `npm run db:seed`.');
  }
  return project.id;
}

/** Unassigned entries land in Others rather than carrying a null project. */
async function resolveProjectId(tx: Tx, projectId?: string | null): Promise<string> {
  if (!projectId) return systemProjectId(tx);
  const project = await tx.project.findUnique({ where: { id: projectId } });
  if (!project) throw new ApiError(400, "That project does not exist");
  return project.id;
}

async function syncTags(tx: Tx, entryId: string, names: string[]): Promise<void> {
  const unique = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  await tx.tagsOnEntries.deleteMany({ where: { entryId } });
  for (const name of unique) {
    const tag = await tx.tag.upsert({ where: { name }, update: {}, create: { name } });
    await tx.tagsOnEntries.create({ data: { entryId, tagId: tag.id } });
  }
}

/**
 * Rejects overlaps with a message naming the conflict. The exclusion constraint
 * in the database is what makes the rule true under concurrency; this exists so
 * the user sees something readable. See ARCHITECTURE.md §4.
 */
async function assertNoConflicts(
  tx: Tx,
  candidate: { id?: string; startedAt: Date; endedAt: Date },
  timezone: string,
): Promise<void> {
  const shapeError = validateEntryShape(candidate);
  if (shapeError) {
    throw new ApiError(
      400,
      shapeError.kind === "end-before-start"
        ? "The end time must be after the start time"
        : "An entry must be at least one minute long",
    );
  }

  const nearby = await tx.timeEntry.findMany({
    where: {
      ...(candidate.id ? { id: { not: candidate.id } } : {}),
      startedAt: { lt: candidate.endedAt },
      OR: [{ endedAt: { gt: candidate.startedAt } }, { endedAt: null }],
    },
    include: { project: { select: { name: true } } },
    take: 10,
  });

  const conflicts = findConflicts(candidate, nearby, new Date());
  if (conflicts.length > 0) {
    const first = conflicts[0];
    const label = first.description?.trim() || first.project.name;
    const end = first.endedAt ?? new Date();
    throw new ApiError(
      409,
      `Overlaps "${label}", ${formatClock(first.startedAt, timezone)}–${formatClock(end, timezone)}`,
      { conflictIds: conflicts.map((c) => c.id) },
    );
  }
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/** Every entry overlapping [from, to), plus the running one if it reaches in. */
export async function listEntries(from: Date, to: Date): Promise<EntryDto[]> {
  const rows = await db.timeEntry.findMany({
    where: {
      startedAt: { lt: to },
      OR: [{ endedAt: { gt: from } }, { endedAt: null }],
    },
    include: entryInclude,
    orderBy: { startedAt: "asc" },
  });
  return rows.map(toEntryDto);
}

/**
 * Every description you have used before, most-used first, for the editor's
 * autocomplete. Ranked by use count rather than alphabetically: the point is to
 * retype "Interview preparation" in two keystrokes, and the block you log every
 * week should be the one waiting at the top. Ties go to the most recent.
 *
 * Each description carries the project it was most recently logged under, so
 * the editor can switch to it the moment you pick a description from the list
 * rather than making you re-pick the project every time. Archived projects are
 * left out of that count. A description whose usual project was retired should
 * not pull new time back into it.
 *
 * The whole list goes to the browser and is filtered there, a few hundred short
 * strings against a request per keystroke. See ARCHITECTURE.md §8.
 */
export async function descriptionHistory(limit: number): Promise<DescriptionSuggestion[]> {
  const top = await db.timeEntry.groupBy({
    by: ["description"],
    where: { description: { not: "" } },
    _count: { description: true },
    _max: { startedAt: true },
    orderBy: [{ _count: { description: "desc" } }, { _max: { startedAt: "desc" } }],
    take: limit,
  });

  const descriptions = top.map((row) => row.description);
  if (descriptions.length === 0) return [];

  // The most-recent project for each description. Rows are ordered by
  // description, then recency of the last entry under that project, then entry
  // count, so the first row per description is the one to keep. Archived
  // projects never win, so a description whose home project was retired has no
  // project here and the editor leaves the current one alone.
  const byProject = await db.timeEntry.groupBy({
    by: ["description", "projectId"],
    where: { description: { in: descriptions }, project: { archivedAt: null } },
    _count: { description: true },
    _max: { startedAt: true },
    orderBy: [
      { description: "asc" },
      { _max: { startedAt: "desc" } },
      { _count: { description: "desc" } },
    ],
  });

  const topProject = new Map<string, string>();
  for (const row of byProject) {
    if (!topProject.has(row.description)) topProject.set(row.description, row.projectId);
  }

  return top.map((row) => ({
    description: row.description,
    projectId: topProject.get(row.description) ?? null,
  }));
}

export async function getRunningEntry(): Promise<EntryDto | null> {
  const row = await db.timeEntry.findFirst({
    where: { endedAt: null },
    include: entryInclude,
  });
  return row ? toEntryDto(row) : null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function createEntry(
  input: z.infer<typeof entryCreateSchema>,
  timezone: string,
): Promise<EntryDto> {
  const startedAt = roundToMinute(input.startedAt);
  const endedAt = roundToMinute(input.endedAt);

  const row = await db.$transaction(async (tx) => {
    await assertNoConflicts(tx, { startedAt, endedAt }, timezone);
    const created = await tx.timeEntry.create({
      data: {
        // Undefined falls back to the column default; the browser only supplies
        // an id when its editor is already open on that row.
        id: input.id,
        description: input.description,
        projectId: await resolveProjectId(tx, input.projectId),
        taskId: input.taskId ?? null,
        startedAt,
        endedAt,
      },
    });
    await syncTags(tx, created.id, input.tags);
    return tx.timeEntry.findUniqueOrThrow({
      where: { id: created.id },
      include: entryInclude,
    });
  });

  return toEntryDto(row);
}

export async function updateEntry(
  id: string,
  input: z.infer<typeof entryUpdateSchema>,
  timezone: string,
): Promise<EntryDto> {
  const row = await db.$transaction(async (tx) => {
    const current = await tx.timeEntry.findUnique({ where: { id } });
    if (!current) throw new ApiError(404, "Entry not found");

    const startedAt = input.startedAt ? roundToMinute(input.startedAt) : current.startedAt;
    const endedAt =
      input.endedAt !== undefined
        ? roundToMinute(input.endedAt)
        : current.endedAt;

    // A running entry stays running unless an explicit end time is supplied.
    if (endedAt !== null) {
      await assertNoConflicts(tx, { id, startedAt, endedAt }, timezone);
    }

    await tx.timeEntry.update({
      where: { id },
      data: {
        description: input.description ?? undefined,
        projectId:
          input.projectId !== undefined
            ? await resolveProjectId(tx, input.projectId)
            : undefined,
        taskId: input.taskId !== undefined ? input.taskId : undefined,
        startedAt,
        endedAt,
      },
    });

    if (input.tags) await syncTags(tx, id, input.tags);

    return tx.timeEntry.findUniqueOrThrow({ where: { id }, include: entryInclude });
  });

  return toEntryDto(row);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.timeEntry.delete({ where: { id } });
}

/**
 * Stop whatever is running and start something new, atomically.
 *
 * The two entries abut exactly: the old one ends at the instant the new one
 * begins. Half-open ranges mean that is not an overlap. If the running entry is
 * less than a minute old we give it its one-minute minimum and start the new
 * entry there, rather than writing a zero-length row the check constraint
 * would reject.
 *
 * `input.startedAt` moves the start back to a minute that has already passed,
 * a click on the grid at 09:00 when it is 09:40. It cannot reach into the future
 * (nothing is "currently" happening later) and it cannot reach back past the
 * timer already running, because stopping that one at an instant before it began
 * is not a state the database will hold.
 */
export async function startTimer(
  input: z.infer<typeof timerStartSchema>,
  timezone = "UTC",
): Promise<EntryDto> {
  const row = await db.$transaction(async (tx) => {
    const now = roundToMinute(new Date());
    const requested = input.startedAt ? roundToMinute(input.startedAt) : now;
    if (requested > now) {
      throw new ApiError(400, "A timer cannot start in the future");
    }

    const running = await tx.timeEntry.findFirst({ where: { endedAt: null } });

    let startedAt = requested;
    if (running) {
      if (requested <= running.startedAt) {
        throw new ApiError(
          409,
          `A timer has been running since ${formatClock(running.startedAt, timezone)}. Stop it before logging anything earlier`,
        );
      }
      const minimumEnd = addMinutes(running.startedAt, 1);
      const end = requested > minimumEnd ? requested : minimumEnd;
      await tx.timeEntry.update({ where: { id: running.id }, data: { endedAt: end } });
      startedAt = end;
    }

    const created = await tx.timeEntry.create({
      data: {
        id: input.id,
        description: input.description,
        projectId: await resolveProjectId(tx, input.projectId),
        taskId: input.taskId ?? null,
        startedAt,
        endedAt: null,
      },
    });
    await syncTags(tx, created.id, input.tags);

    return tx.timeEntry.findUniqueOrThrow({
      where: { id: created.id },
      include: entryInclude,
    });
  });

  return toEntryDto(row);
}

export async function stopTimer(): Promise<EntryDto> {
  const row = await db.$transaction(async (tx) => {
    const running = await tx.timeEntry.findFirst({ where: { endedAt: null } });
    if (!running) throw new ApiError(404, "No timer is running");

    const now = roundToMinute(new Date());
    const minimumEnd = addMinutes(running.startedAt, 1);
    let endedAt = now > minimumEnd ? now : minimumEnd;

    // Don't let a long-running timer swallow a manually-planned future block.
    const next = await tx.timeEntry.findFirst({
      where: {
        id: { not: running.id },
        startedAt: { gt: running.startedAt, lt: endedAt },
      },
      orderBy: { startedAt: "asc" },
    });
    if (next) endedAt = next.startedAt;

    if (endedAt <= running.startedAt) {
      throw new ApiError(409, "Another entry starts at the same moment. Edit it first.");
    }

    await tx.timeEntry.update({ where: { id: running.id }, data: { endedAt } });
    return tx.timeEntry.findUniqueOrThrow({
      where: { id: running.id },
      include: entryInclude,
    });
  });

  return toEntryDto(row);
}
