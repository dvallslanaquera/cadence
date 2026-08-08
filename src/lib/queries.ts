"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { roundToMinute } from "@/domain/time";
import { api, ApiClientError } from "./api";
import { RUNNING_POLL_MS } from "./constants";
import { t, plural, getCurrentLang } from "./i18n";
import type {
  DailyStat,
  DescriptionSuggestion,
  Entry,
  Project,
  ProjectRef,
  ProjectStat,
  RunningState,
  Settings,
  SummaryStat,
  Task,
  TaskSection,
  TaskStatus,
  WeeklyStat,
} from "./types";

export const keys = {
  entries: (from: string, to: string) => ["entries", from, to] as const,
  running: ["entries", "running"] as const,
  projects: ["projects"] as const,
  frequentProjects: ["projects", "frequent"] as const,
  tasks: (filter: string) => ["tasks", filter] as const,
  tags: ["tags"] as const,
  // Not under "entries": every drag invalidates that whole root, and refetching autocomplete history mid-drag buys nothing.
  descriptions: ["descriptions"] as const,
  settings: ["settings"] as const,
  statsDaily: (from: string, to: string) => ["stats", "daily", from, to] as const,
  statsWeekly: (weeks: number) => ["stats", "weekly", weeks] as const,
  statsProjects: (from: string, to: string) => ["stats", "projects", from, to] as const,
};

/** Anything that changes time data invalidates all three. */
function invalidateTimeData(client: QueryClient) {
  void client.invalidateQueries({ queryKey: ["entries"] });
  void client.invalidateQueries({ queryKey: ["stats"] });
  void client.invalidateQueries({ queryKey: ["tasks"] });
}

function reportError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return; // already redirecting
    toast.error(error.message);
    return;
  }
  toast.error(t("toast.somethingWrong"));
}

// Optimistic cache surgery: every timer mutation writes the expected result in onMutate, rolls back in onError, and lets onSettled's refetch reconcile what the server actually decided (minute rounding, one-minute minimum, clip against the next entry). The optimistic value is a guess, never the source of truth. See ARCHITECTURE.md §13.

interface EntriesPayload {
  entries: Entry[];
}

// Creates the server has not answered yet. The editor opens on a new entry the moment you double-click, so controls that name a row the database may not have yet wait here first. Waiting on all of them also covers stop-the-timer, which names no id.
const pendingCreates = new Set<Promise<unknown>>();

function trackCreate<T>(work: Promise<T>): Promise<T> {
  const settled = work.then(
    () => undefined,
    () => undefined,
  );
  pendingCreates.add(settled);
  void settled.finally(() => pendingCreates.delete(settled));
  return work;
}

/** Resolves once every in-flight create has landed, however it went. */
function afterPendingCreates(): Promise<unknown> {
  return pendingCreates.size === 0 ? Promise.resolve() : Promise.all(pendingCreates);
}

// Every cached week, but not the running query. Both live under "entries"; a week key is ["entries", from, to] and the running key is ["entries", "running"], so the length tells them apart.
const ENTRY_LISTS = {
  queryKey: ["entries"],
  predicate: (query: { queryKey: readonly unknown[] }) => query.queryKey.length === 3,
} as const;

type CacheSnapshot = [readonly unknown[], unknown][];

/** Cancel in-flight refetches so they cannot land on top of the optimistic write. */
async function beginOptimistic(client: QueryClient, root: string): Promise<CacheSnapshot> {
  await client.cancelQueries({ queryKey: [root] });
  return client.getQueriesData({ queryKey: [root] });
}

function rollback(client: QueryClient, snapshot: CacheSnapshot | undefined) {
  for (const [key, data] of snapshot ?? []) client.setQueryData(key, data);
}

/** Rewrite each cached week; `range` is that week's [from, to). */
function updateEntryLists(
  client: QueryClient,
  update: (entries: Entry[], range: { from: Date; to: Date }) => Entry[],
) {
  for (const [key, data] of client.getQueriesData<EntriesPayload>(ENTRY_LISTS)) {
    if (!data) continue;
    const [, from, to] = key as [string, string, string];
    client.setQueryData<EntriesPayload>(key, {
      entries: update(data.entries, { from: new Date(from), to: new Date(to) }),
    });
  }
}

function patchEntry(client: QueryClient, id: string, patch: (entry: Entry) => Entry) {
  updateEntryLists(client, (entries) =>
    entries.map((entry) => (entry.id === id ? patch(entry) : entry)),
  );
}

/** The project a mutation names, from whatever the projects cache holds. */
function cachedProject(client: QueryClient, projectId?: string | null): ProjectRef | null {
  const lists = client.getQueriesData<{ projects: Project[] }>({ queryKey: keys.projects });
  const projects = lists.flatMap(([, data]) => data?.projects ?? []);
  if (projectId) return projects.find((project) => project.id === projectId) ?? null;
  return projects.find((project) => project.isSystem) ?? null;
}

const PLACEHOLDER_PROJECT: ProjectRef = { id: "", name: "…", color: "#94a3b8" };

interface TasksPayload {
  tasks: Task[];
}

// Rewrite every cached task list, then re-apply the filter that produced it (the query string is the second half of the key). Completing a task while "Open" is showing removes it; moving one to Study removes it from a Work-filtered list, instead of leaving a ghost row until the refetch.
function updateTaskLists(client: QueryClient, update: (tasks: Task[]) => Task[]) {
  for (const [key, data] of client.getQueriesData<TasksPayload>({ queryKey: ["tasks"] })) {
    if (!data) continue;
    const filter = new URLSearchParams(String(key[1] ?? ""));
    const status = filter.get("status");
    const section = filter.get("section");
    const dueFrom = filter.get("dueFrom");
    const dueTo = filter.get("dueTo");

    client.setQueryData<TasksPayload>(key, {
      tasks: update(data.tasks).filter(
        (task) =>
          (!status || task.status === status) &&
          (!section || task.section === section) &&
          // A due-date filter excludes undated tasks server-side too.
          (!dueFrom || (task.dueDate !== null && task.dueDate >= dueFrom)) &&
          (!dueTo || (task.dueDate !== null && task.dueDate <= dueTo)),
      ),
    });
  }
}

// Reads

export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => api.get<{ settings: Settings }>("/api/settings"),
    select: (data) => data.settings,
    staleTime: 60_000,
  });
}

export function useEntries(from: Date, to: Date) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery({
    queryKey: keys.entries(fromIso, toIso),
    queryFn: () =>
      api.get<{ entries: Entry[] }>(
        `/api/entries?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      ),
    select: (data) => data.entries,
  });
}

/** Polls every 30s and refetches on focus, so phone and laptop agree without offline machinery. See ARCHITECTURE.md §13. */
export function useRunning() {
  return useQuery({
    queryKey: keys.running,
    queryFn: () => api.get<RunningState>("/api/entries/running"),
    refetchInterval: RUNNING_POLL_MS,
    refetchOnWindowFocus: true,
    refetchIntervalInBackground: false,
  });
}

export function useProjects(includeArchived = false) {
  return useQuery({
    queryKey: [...keys.projects, includeArchived],
    queryFn: () =>
      api.get<{ projects: Project[] }>(
        `/api/projects${includeArchived ? "?archived=true" : ""}`,
      ),
    select: (data) => data.projects,
    staleTime: 30_000,
  });
}

/** Ids of the most-used projects, most-used first. Shares the "projects" prefix so creating or deleting a project refreshes the shortlist. */
export function useFrequentProjectIds() {
  return useQuery({
    queryKey: keys.frequentProjects,
    queryFn: () => api.get<{ projectIds: string[] }>("/api/projects/frequent"),
    select: (data) => data.projectIds,
    staleTime: 60_000,
  });
}

export function useTasks(
  params: {
    status?: TaskStatus;
    section?: TaskSection;
    dueFrom?: string;
    dueTo?: string;
  } = {},
) {
  const search = new URLSearchParams();
  if (params.status) search.set("status", params.status);
  if (params.section) search.set("section", params.section);
  if (params.dueFrom) search.set("dueFrom", params.dueFrom);
  if (params.dueTo) search.set("dueTo", params.dueTo);
  const qs = search.toString();

  return useQuery({
    queryKey: keys.tasks(qs),
    queryFn: () => api.get<{ tasks: Task[] }>(`/api/tasks${qs ? `?${qs}` : ""}`),
    select: (data) => data.tasks,
  });
}

export function useTags() {
  return useQuery({
    queryKey: keys.tags,
    queryFn: () => api.get<{ tags: string[] }>("/api/tags"),
    select: (data) => data.tags,
    staleTime: 60_000,
  });
}

// Past entry descriptions for the editor's autocomplete, most-used first, each paired with the project it is most often logged under so the editor can switch to it when one is chosen. One fetch feeds every keystroke; a minute of staleness only delays a description you invented a minute ago from joining the list.
export function useDescriptionHistory() {
  return useQuery({
    queryKey: keys.descriptions,
    queryFn: () =>
      api.get<{ descriptions: DescriptionSuggestion[] }>("/api/entries/descriptions"),
    select: (data) => data.descriptions,
    staleTime: 60_000,
  });
}

export function useDailyStats(from: Date, to: Date) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery({
    queryKey: keys.statsDaily(fromIso, toIso),
    queryFn: () =>
      api.get<{ days: DailyStat[]; summary: SummaryStat; dailyGoalHours: number }>(
        `/api/stats/daily?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      ),
  });
}

export function useWeeklyStats(weeks: number) {
  return useQuery({
    queryKey: keys.statsWeekly(weeks),
    queryFn: () =>
      api.get<{ weeks: WeeklyStat[]; dailyGoalHours: number }>(
        `/api/stats/weekly?weeks=${weeks}`,
      ),
  });
}

export function useProjectStats(from: Date, to: Date) {
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  return useQuery({
    queryKey: keys.statsProjects(fromIso, toIso),
    queryFn: () =>
      api.get<{ projects: ProjectStat[] }>(
        `/api/stats/projects?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      ),
    select: (data) => data.projects,
  });
}

// Timer

export interface StartTimerInput {
  description?: string;
  projectId?: string | null;
  taskId?: string | null;
  tags?: string[];
  /** A minute that has already passed, from a click on the grid. Defaults to now. */
  startedAt?: string;
  /** The id to create the entry under, from newEntryId; the grid opens the editor before the server answers. See ARCHITECTURE.md §8. */
  id?: string;
}

export function useStartTimer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: StartTimerInput) =>
      trackCreate(api.post<{ entry: Entry }>("/api/timer/start", input)),

    onMutate: async (input) => {
      const snapshot = await beginOptimistic(client, "entries");
      const startedAt = roundToMinute(input.startedAt ? new Date(input.startedAt) : new Date());

      const optimistic: Entry = {
        // Without a caller-supplied id, the server's row replaces this on the next refetch; distinct enough never to be mistaken for a real cuid.
        id: input.id ?? `optimistic-${startedAt.getTime()}`,
        description: input.description ?? "",
        startedAt: startedAt.toISOString(),
        endedAt: null,
        alertSentAt: null,
        project: cachedProject(client, input.projectId) ?? PLACEHOLDER_PROJECT,
        task: null,
        tags: input.tags ?? [],
      };

      // Starting a timer stops whatever was running, abutting it exactly.
      const previous = client.getQueryData<RunningState>(keys.running)?.entry ?? null;
      if (previous) {
        patchEntry(client, previous.id, (entry) => ({
          ...entry,
          endedAt: startedAt.toISOString(),
        }));
      }

      updateEntryLists(client, (entries, range) =>
        startedAt < range.to ? [...entries, optimistic] : entries,
      );
      client.setQueryData<RunningState>(keys.running, (state) =>
        state ? { ...state, entry: optimistic } : state,
      );

      return { snapshot };
    },

    // Take the server's row now rather than at the end of the refetch; the editor is open on this id and its start may have been clipped against whatever was running.
    onSuccess: (result, input) => {
      const id = input.id;
      if (!id) return;
      patchEntry(client, id, () => result.entry);
      client.setQueryData<RunningState>(keys.running, (state) =>
        state && state.entry?.id === id ? { ...state, entry: result.entry } : state,
      );
    },

    onError: (error, _input, context) => {
      rollback(client, context?.snapshot);
      reportError(error);
    },
    onSettled: () => invalidateTimeData(client),
  });
}

export function useStopTimer() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await afterPendingCreates();
      return api.post<{ entry: Entry }>("/api/timer/stop");
    },

    onMutate: async () => {
      const snapshot = await beginOptimistic(client, "entries");
      const running = client.getQueryData<RunningState>(keys.running)?.entry ?? null;

      if (running) {
        // Server enforces a one-minute minimum and may clip the end against a later entry; the refetch corrects both.
        const endedAt = roundToMinute(new Date()).toISOString();
        patchEntry(client, running.id, (entry) => ({ ...entry, endedAt }));
      }
      client.setQueryData<RunningState>(keys.running, (state) =>
        state ? { ...state, entry: null } : state,
      );

      return { snapshot };
    },

    onError: (error, _input, context) => {
      rollback(client, context?.snapshot);
      reportError(error);
    },
    onSettled: () => invalidateTimeData(client),
  });
}

// Entries

export interface CreateEntryInput {
  description?: string;
  projectId?: string | null;
  taskId?: string | null;
  startedAt: string;
  endedAt: string;
  tags?: string[];
  /** See `StartTimerInput.id`. */
  id?: string;
}

export function useCreateEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateEntryInput) =>
      trackCreate(api.post<{ entry: Entry }>("/api/entries", input)),

    onMutate: async (input) => {
      const snapshot = await beginOptimistic(client, "entries");
      const startedAt = new Date(input.startedAt);

      const optimistic: Entry = {
        id: input.id ?? `optimistic-${startedAt.getTime()}`,
        description: input.description ?? "",
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        alertSentAt: null,
        project: cachedProject(client, input.projectId) ?? PLACEHOLDER_PROJECT,
        task: null,
        tags: input.tags ?? [],
      };

      updateEntryLists(client, (entries, range) =>
        startedAt >= range.from && startedAt < range.to ? [...entries, optimistic] : entries,
      );

      return { snapshot };
    },

    // See useStartTimer: the editor is open on this id while the POST is in the air, so the server's rounding lands as soon as it arrives.
    onSuccess: (result, input) => {
      if (input.id) patchEntry(client, input.id, () => result.entry);
    },

    onError: (error, _input, context) => {
      rollback(client, context?.snapshot);
      reportError(error);
    },
    onSettled: () => invalidateTimeData(client),
  });
}

export interface UpdateEntryInput {
  description?: string;
  projectId?: string | null;
  taskId?: string | null;
  startedAt?: string;
  endedAt?: string;
  tags?: string[];
}

// Optimistic, because this is the drag handler: a block that snaps back until the PATCH returns reads as lag however fast the server is. A rejected edit (an overlap, most often) rolls the block back and the toast says why.
export function useUpdateEntry() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateEntryInput & { id: string }) => {
      await afterPendingCreates();
      return api.patch<{ entry: Entry }>(`/api/entries/${id}`, input);
    },

    onMutate: async ({ id, ...input }) => {
      const snapshot = await beginOptimistic(client, "entries");

      patchEntry(client, id, (entry) => ({
        ...entry,
        description: input.description ?? entry.description,
        startedAt: input.startedAt ?? entry.startedAt,
        endedAt: input.endedAt !== undefined ? input.endedAt : entry.endedAt,
        tags: input.tags ?? entry.tags,
        project:
          input.projectId !== undefined
            ? (cachedProject(client, input.projectId) ?? entry.project)
            : entry.project,
      }));

      // A running entry being edited is also the one the header bar shows.
      client.setQueryData<RunningState>(keys.running, (state) =>
        state?.entry?.id === id
          ? {
              ...state,
              entry: {
                ...state.entry,
                description: input.description ?? state.entry.description,
                startedAt: input.startedAt ?? state.entry.startedAt,
              },
            }
          : state,
      );

      return { snapshot };
    },

    onError: (error, _input, context) => {
      rollback(client, context?.snapshot);
      reportError(error);
    },
    onSettled: () => invalidateTimeData(client),
  });
}

// Delete is optimistic with an undo toast rather than a confirm dialog: a mis-click costs one click to reverse, and a confirm on every delete gets clicked through blindly within a week. See ARCHITECTURE.md §17.
export function useDeleteEntry() {
  const client = useQueryClient();
  const recreate = useCreateEntry();

  return useMutation({
    mutationFn: async (entry: Entry) => {
      await afterPendingCreates();
      return api.delete<{ ok: true }>(`/api/entries/${entry.id}`);
    },
    onSuccess: (_result, entry) => {
      invalidateTimeData(client);
      if (!entry.endedAt) return; // a running entry can't be recreated verbatim
      toast(t("toast.entryDeleted"), {
        action: {
          label: t("toast.undo"),
          onClick: () => {
            recreate.mutate({
              description: entry.description,
              projectId: entry.project.id,
              taskId: entry.task?.id ?? null,
              startedAt: entry.startedAt,
              endedAt: entry.endedAt as string,
              tags: entry.tags,
            });
          },
        },
      });
    },
    onError: reportError,
  });
}

// Projects

export function useCreateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; color: string }) =>
      api.post<{ project: Project }>("/api/projects", input),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.projects }),
    onError: reportError,
  });
}

export function useUpdateProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      color?: string;
      archived?: boolean;
    }) => api.patch<{ project: Project }>(`/api/projects/${id}`, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.projects });
      void client.invalidateQueries({ queryKey: ["entries"] });
    },
    onError: reportError,
  });
}

export function useDeleteProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ moved: { entries: number; tasks: number } }>(
        `/api/projects/${id}?confirm=true`,
      ),
    onSuccess: (result) => {
      invalidateTimeData(client);
      void client.invalidateQueries({ queryKey: keys.projects });
      const { entries, tasks } = result.moved;
      if (entries || tasks) {
        const lang = getCurrentLang();
        toast.success(
          t("toast.movedToOthers", {
            entries: plural(lang, entries, "common.entry.one", "common.entry.other"),
            tasks: plural(lang, tasks, "common.task.one", "common.task.other"),
          }),
        );
      }
    },
    onError: reportError,
  });
}

// Tasks

export function useCreateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      name: string;
      projectId?: string | null;
      section?: TaskSection;
      dueDate?: string | null;
      notes?: string | null;
    }) => api.post<{ task: Task }>("/api/tasks", input),

    onMutate: async (input) => {
      const snapshot = await beginOptimistic(client, "tasks");

      const optimistic: Task = {
        id: `optimistic-${Date.now()}`,
        name: input.name,
        notes: input.notes ?? null,
        status: "OPEN",
        section: input.section ?? "WORK",
        dueDate: input.dueDate ?? null,
        completedAt: null,
        // New tasks go to the top of the backlog; lists sort by sortOrder.
        sortOrder: Number.MIN_SAFE_INTEGER,
        project: cachedProject(client, input.projectId) ?? PLACEHOLDER_PROJECT,
        loggedMinutes: 0,
      };

      updateTaskLists(client, (tasks) => [optimistic, ...tasks]);
      return { snapshot };
    },

    onError: (error, _input, context) => {
      rollback(client, context?.snapshot);
      reportError(error);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      name?: string;
      notes?: string | null;
      projectId?: string | null;
      section?: TaskSection;
      dueDate?: string | null;
      status?: TaskStatus;
    }) => api.patch<{ task: Task }>(`/api/tasks/${id}`, input),

    onMutate: async ({ id, ...input }) => {
      const snapshot = await beginOptimistic(client, "tasks");

      updateTaskLists(client, (tasks) =>
        tasks.map((task) =>
          task.id === id
            ? {
                ...task,
                name: input.name ?? task.name,
                notes: input.notes !== undefined ? input.notes : task.notes,
                status: input.status ?? task.status,
                section: input.section ?? task.section,
                dueDate: input.dueDate !== undefined ? input.dueDate : task.dueDate,
                project:
                  input.projectId !== undefined
                    ? (cachedProject(client, input.projectId) ?? task.project)
                    : task.project,
              }
            : task,
        ),
      );

      return { snapshot };
    },

    onError: (error, _input, context) => {
      rollback(client, context?.snapshot);
      reportError(error);
    },
    onSettled: () => client.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useDeleteTask() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(`/api/tasks/${id}`),

    onMutate: async (id) => {
      const snapshot = await beginOptimistic(client, "tasks");
      updateTaskLists(client, (tasks) => tasks.filter((task) => task.id !== id));
      return { snapshot };
    },

    onError: (error, _id, context) => {
      rollback(client, context?.snapshot);
      reportError(error);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["tasks"] });
      // Entries survive a deleted task but lose the link, so their labels change.
      void client.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}

// Settings

export function useUpdateSettings() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<Omit<Settings, "lastAlertCheckAt">>) =>
      api.patch<{ settings: Settings }>("/api/settings", input),
    // A refetch from the previous save can still be in flight, and landing after this
    // one it would put the old theme back for a beat. Cancel it and write through, so
    // nothing older than this click can win.
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: keys.settings });
      const previous = client.getQueryData<{ settings: Settings }>(keys.settings);
      if (previous) {
        client.setQueryData(keys.settings, { settings: { ...previous.settings, ...input } });
      }
      return { previous };
    },
    onSuccess: (data) => {
      client.setQueryData(keys.settings, data);
      // The response is the whole updated row, so settings needs no refetch. Everything
      // else does: timezone and the goal hours change how entries and stats render.
      void client.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "settings" });
      toast.success(t("toast.settingsSaved"));
    },
    onError: (error, _input, context) => {
      if (context?.previous) client.setQueryData(keys.settings, context.previous);
      reportError(error);
    },
  });
}
