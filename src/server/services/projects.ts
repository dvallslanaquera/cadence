import { z } from "zod";
import { db } from "@/server/db";
import { ApiError } from "@/server/api";
import { projectCreateSchema, projectUpdateSchema } from "@/lib/schemas";

export interface ProjectDto {
  id: string;
  name: string;
  color: string;
  isSystem: boolean;
  archived: boolean;
}

export async function listProjects(includeArchived: boolean): Promise<ProjectDto[]> {
  const rows = await db.project.findMany({
    where: includeArchived ? {} : { archivedAt: null },
    orderBy: [{ isSystem: "asc" }, { name: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    isSystem: row.isSystem,
    archived: row.archivedAt !== null,
  }));
}

/**
 * The projects to offer first in the picker, most-used first.
 *
 * Ranked by number of entries rather than minutes logged, so a project you keep
 * switching into outranks one long block. Archived projects never appear —
 * they are not somewhere new time should be logged.
 */
export async function frequentProjectIds(windowDays: number, limit: number): Promise<string[]> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const grouped = await db.timeEntry.groupBy({
    by: ["projectId"],
    where: { startedAt: { gte: since }, project: { archivedAt: null } },
    _count: { _all: true },
    orderBy: { _count: { projectId: "desc" } },
    take: limit,
  });

  return grouped.map((row) => row.projectId);
}

export async function createProject(
  input: z.infer<typeof projectCreateSchema>,
): Promise<ProjectDto> {
  const row = await db.project.create({ data: input });
  return { ...row, archived: false };
}

export async function updateProject(
  id: string,
  input: z.infer<typeof projectUpdateSchema>,
): Promise<ProjectDto> {
  const current = await db.project.findUnique({ where: { id } });
  if (!current) throw new ApiError(404, "Project not found");
  if (current.isSystem && input.name && input.name !== current.name) {
    throw new ApiError(400, "The Others project cannot be renamed");
  }
  if (current.isSystem && input.archived) {
    throw new ApiError(400, "The Others project cannot be archived");
  }

  const row = await db.project.update({
    where: { id },
    data: {
      name: input.name,
      color: input.color,
      archivedAt:
        input.archived === undefined ? undefined : input.archived ? new Date() : null,
    },
  });

  return {
    id: row.id,
    name: row.name,
    color: row.color,
    isSystem: row.isSystem,
    archived: row.archivedAt !== null,
  };
}

export interface ProjectDeletionImpact {
  entries: number;
  tasks: number;
}

/** What a delete would move to Others — shown in the confirm dialog. */
export async function projectDeletionImpact(id: string): Promise<ProjectDeletionImpact> {
  const [entries, tasks] = await Promise.all([
    db.timeEntry.count({ where: { projectId: id } }),
    db.task.count({ where: { projectId: id } }),
  ]);
  return { entries, tasks };
}

/**
 * Deleting a project never destroys time data: its entries and tasks are moved
 * to Others first. See ARCHITECTURE.md §5.
 */
export async function deleteProject(id: string): Promise<ProjectDeletionImpact> {
  return db.$transaction(async (tx) => {
    const project = await tx.project.findUnique({ where: { id } });
    if (!project) throw new ApiError(404, "Project not found");
    if (project.isSystem) throw new ApiError(400, "The Others project cannot be deleted");

    const others = await tx.project.findFirst({ where: { isSystem: true } });
    if (!others) throw new ApiError(500, 'No "Others" project — run `npm run db:seed`');

    const entries = await tx.timeEntry.updateMany({
      where: { projectId: id },
      data: { projectId: others.id },
    });
    const tasks = await tx.task.updateMany({
      where: { projectId: id },
      data: { projectId: others.id },
    });

    await tx.project.delete({ where: { id } });
    return { entries: entries.count, tasks: tasks.count };
  });
}
