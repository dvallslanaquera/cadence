/**
 * Wire types. Declared here rather than imported from the server so nothing in
 * the client bundle has a path back to Prisma.
 */

export interface ProjectRef {
  id: string;
  name: string;
  color: string;
}

export interface DescriptionSuggestion {
  description: string;
  /** The project this description is most often logged under, or null if
   * every past pairing was with a now-archived project. */
  projectId: string | null;
}

export interface Project extends ProjectRef {
  isSystem: boolean;
  archived: boolean;
}

export interface TaskRef {
  id: string;
  name: string;
}

export interface Entry {
  id: string;
  description: string;
  /** ISO instant. */
  startedAt: string;
  /** ISO instant, or null while running. */
  endedAt: string | null;
  alertSentAt: string | null;
  project: ProjectRef;
  task: TaskRef | null;
  tags: string[];
}

export type TaskStatus = "OPEN" | "DONE";

/** The backlog's top-level split. Coarser than a project. */
export type TaskSection = "WORK" | "STUDY";

export interface Task {
  id: string;
  name: string;
  notes: string | null;
  status: TaskStatus;
  section: TaskSection;
  /** "2026-07-28" or null. */
  dueDate: string | null;
  completedAt: string | null;
  sortOrder: number;
  project: ProjectRef;
  loggedMinutes: number;
}

export interface Settings {
  timezone: string;
  dailyGoalHours: number;
  weeklyChartWeeks: number;
  alertAfterHours: number;
  theme: string;
  language: string;
  alertsEnabled: boolean;
  lastAlertCheckAt: string | null;
}

export interface RunningState {
  entry: Entry | null;
  alertAfterHours: number;
  schedulerStale: boolean;
}

export interface DailyStat {
  day: string;
  minutes: number;
}

export interface WeeklyStat {
  week: string;
  weekStart: string;
  minutes: number;
}

export interface ProjectStat {
  projectId: string;
  name: string;
  color: string;
  minutes: number;
}

export interface SummaryStat {
  totalMinutes: number;
  activeDays: number;
  longestDayMinutes: number;
  longestDay: string | null;
}
