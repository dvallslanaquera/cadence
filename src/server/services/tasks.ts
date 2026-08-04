import { Prisma, type TaskSection, type TaskStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/server/db";
import { ApiError } from "@/server/api";
import { taskCreateSchema, taskUpdateSchema } from "@/lib/schemas";

const taskInclude = {
  project: { select: { id: true, name: true, color: true } },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;

export interface TaskDto {
  id: string;
  name: string;
  notes: string | null;
  status: TaskStatus;
  section: TaskSection;
  /** "2026-07-28" or null. A calendar date, deliberately not an instant. */
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  project: { id: string; name: string; color: string };
  /** Total time logged against this task, in minutes. */
  loggedMinutes: number;
}

/** `@db.Date` comes back as a UTC-midnight Date; take the calendar part only. */
function toDateKey(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function fromDateKey(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function toTaskDto(row: TaskRow, loggedMinutes: number): TaskDto {
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    status: row.status,
    section: row.section,
    dueDate: toDateKey(row.dueDate),
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    sortOrder: row.sortOrder,
    project: row.project,
    loggedMinutes,
  };
}

export interface TaskFilters {
  status?: TaskStatus;
  section?: TaskSection;
  projectId?: string;
  dueFrom?: string;
  dueTo?: string;
}

export async function listTasks(filters: TaskFilters): Promise<TaskDto[]> {
  const rows = await db.task.findMany({
    where: {
      status: filters.status,
      section: filters.section,
      projectId: filters.projectId,
      ...(filters.dueFrom || filters.dueTo
        ? {
            dueDate: {
              gte: fromDateKey(filters.dueFrom) ?? undefined,
              lte: fromDateKey(filters.dueTo) ?? undefined,
            },
          }
        : {}),
    },
    include: taskInclude,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const logged = await loggedMinutesByTask(rows.map((row) => row.id));
  return rows.map((row) => toTaskDto(row, logged.get(row.id) ?? 0));
}

/**
 * Time logged per task. A running entry counts up to now, so the backlog shows
 * live progress rather than jumping when the timer stops.
 */
async function loggedMinutesByTask(taskIds: string[]): Promise<Map<string, number>> {
  if (taskIds.length === 0) return new Map();

  const rows = await db.$queryRaw<Array<{ taskId: string; minutes: number }>>`
    SELECT e."taskId" AS "taskId",
           COALESCE(SUM(
             EXTRACT(EPOCH FROM (COALESCE(e."endedAt", NOW()) - e."startedAt")) / 60
           ), 0)::int AS minutes
    FROM "TimeEntry" e
    WHERE e."taskId" = ANY(${taskIds})
    GROUP BY e."taskId"
  `;

  return new Map(rows.map((row) => [row.taskId, Number(row.minutes)]));
}

async function resolveProjectId(projectId?: string | null): Promise<string> {
  if (projectId) {
    const project = await db.project.findUnique({ where: { id: projectId } });
    if (!project) throw new ApiError(400, "That project does not exist");
    return project.id;
  }
  const others = await db.project.findFirst({ where: { isSystem: true } });
  if (!others) throw new ApiError(500, 'No "Others" project. Run `npm run db:seed`.');
  return others.id;
}

export async function createTask(
  input: z.infer<typeof taskCreateSchema>,
): Promise<TaskDto> {
  const lowest = await db.task.findFirst({
    orderBy: { sortOrder: "asc" },
    select: { sortOrder: true },
  });

  const row = await db.task.create({
    data: {
      name: input.name,
      notes: input.notes ?? null,
      projectId: await resolveProjectId(input.projectId),
      section: input.section,
      dueDate: fromDateKey(input.dueDate) ?? null,
      // New tasks go to the top of the backlog.
      sortOrder: (lowest?.sortOrder ?? 0) - 1,
    },
    include: taskInclude,
  });

  return toTaskDto(row, 0);
}

export async function updateTask(
  id: string,
  input: z.infer<typeof taskUpdateSchema>,
): Promise<TaskDto> {
  const current = await db.task.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, "Task not found");

  const row = await db.task.update({
    where: { id },
    data: {
      name: input.name,
      notes: input.notes,
      dueDate: fromDateKey(input.dueDate),
      section: input.section,
      sortOrder: input.sortOrder,
      projectId:
        input.projectId !== undefined ? await resolveProjectId(input.projectId) : undefined,
      status: input.status,
      // Completing stamps the time; reopening clears it.
      completedAt:
        input.status === undefined
          ? undefined
          : input.status === "DONE"
            ? (current.completedAt ?? new Date())
            : null,
    },
    include: taskInclude,
  });

  const logged = await loggedMinutesByTask([id]);
  return toTaskDto(row, logged.get(id) ?? 0);
}

/** Entries survive; only the task link goes (onDelete: SetNull). */
export async function deleteTask(id: string): Promise<void> {
  await db.task.delete({ where: { id } });
}

export async function reorderTasks(orderedIds: string[]): Promise<void> {
  await db.$transaction(
    orderedIds.map((id, index) =>
      db.task.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
}
