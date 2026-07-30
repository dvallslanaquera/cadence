import { z } from "zod";

/** Shared by the route handlers and the forms, so they cannot drift. */

const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime())
  .transform((value) => new Date(value));

export const entryCreateSchema = z.object({
  description: z.string().trim().max(500).default(""),
  projectId: z.string().min(1).nullable().optional(),
  taskId: z.string().min(1).nullable().optional(),
  startedAt: isoDateTime,
  endedAt: isoDateTime,
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
});

export const entryUpdateSchema = z.object({
  description: z.string().trim().max(500).optional(),
  projectId: z.string().min(1).nullable().optional(),
  taskId: z.string().min(1).nullable().optional(),
  startedAt: isoDateTime.optional(),
  endedAt: isoDateTime.optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).optional(),
});

export const timerStartSchema = z.object({
  description: z.string().trim().max(500).default(""),
  projectId: z.string().min(1).nullable().optional(),
  taskId: z.string().min(1).nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
  /**
   * When the work began, for a click on the grid at a minute that has already
   * passed. Omitted by the play button and the backlog, which mean "now".
   */
  startedAt: isoDateTime.optional(),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour"),
});

export const projectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Expected a hex colour")
    .optional(),
  archived: z.boolean().optional(),
});

export const taskSectionSchema = z.enum(["WORK", "STUDY"]);

export const taskCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  notes: z.string().trim().max(2000).nullable().optional(),
  projectId: z.string().min(1).nullable().optional(),
  /** Which half of the backlog this belongs in. */
  section: taskSectionSchema.default("WORK"),
  /** A calendar date, "2026-07-28" — not an instant. */
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  status: z.enum(["OPEN", "DONE"]).optional(),
  sortOrder: z.number().int().optional(),
});

export const settingsUpdateSchema = z.object({
  timezone: z.string().min(1).max(60).optional(),
  dailyGoalHours: z.number().min(0).max(24).optional(),
  weeklyChartWeeks: z.number().int().min(1).max(260).optional(),
  alertAfterHours: z.number().int().min(1).max(72).optional(),
});

export type EntryCreateInput = z.input<typeof entryCreateSchema>;
export type TaskCreateInput = z.input<typeof taskCreateSchema>;
