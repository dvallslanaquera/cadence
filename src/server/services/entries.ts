import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { ApiError } from "@/server/api";
import { findConflicts, validateEntryShape } from "@/domain/overlap";
import { addMinutes, formatClock, roundToMinute } from "@/domain/time";
import { entryCreateSchema, entryUpdateSchema, timerStartSchema } from "@/lib/schemas";

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
    throw new ApiError(500, 'No "Others" project — run `npm run db:seed`');
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
      `Overlaps “${label}”, ${formatClock(first.startedAt, timezone)}–${formatClock(end, timezone)}`,
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
 */
export async function startTimer(
  input: z.infer<typeof timerStartSchema>,
): Promise<EntryDto> {
  const row = await db.$transaction(async (tx) => {
    const now = roundToMinute(new Date());
    const running = await tx.timeEntry.findFirst({ where: { endedAt: null } });

    let startedAt = now;
    if (running) {
      const minimumEnd = addMinutes(running.startedAt, 1);
      const end = now > minimumEnd ? now : minimumEnd;
      await tx.timeEntry.update({ where: { id: running.id }, data: { endedAt: end } });
      startedAt = end;
    }

    const created = await tx.timeEntry.create({
      data: {
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
      throw new ApiError(409, "Another entry starts at the same moment — edit it first");
    }

    await tx.timeEntry.update({ where: { id: running.id }, data: { endedAt } });
    return tx.timeEntry.findUniqueOrThrow({
      where: { id: running.id },
      include: entryInclude,
    });
  });

  return toEntryDto(row);
}
