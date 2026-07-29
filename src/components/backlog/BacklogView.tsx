"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  Play,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  useCreateTask,
  useDeleteTask,
  useProjects,
  useSettings,
  useStartTimer,
  useTasks,
  useUpdateTask,
} from "@/lib/queries";
import { dayKey as toDayKey, formatDurationHuman } from "@/domain/time";
import { cn } from "@/lib/utils";
import {
  Button,
  ColorDot,
  EmptyState,
  IconButton,
  Input,
  Select,
  Spinner,
} from "@/components/ui/primitives";
import type { Task, TaskSection, TaskStatus } from "@/lib/types";

type Filter = "OPEN" | "DONE" | "ALL";

/**
 * The backlog's top-level split, in display order. A section is coarser than a
 * project and independent of it: the same project can hold tasks on both sides,
 * which is why this is a field on the task rather than on the project.
 */
const SECTIONS: { value: TaskSection; label: string; short: string }[] = [
  { value: "WORK", label: "Work-related tasks", short: "Work" },
  { value: "STUDY", label: "Study tasks", short: "Study" },
];

const otherSection = (section: TaskSection): TaskSection =>
  section === "WORK" ? "STUDY" : "WORK";

const shortLabel = (section: TaskSection): string =>
  SECTIONS.find((entry) => entry.value === section)?.short ?? section;

interface ProjectGroup {
  project: Task["project"];
  tasks: Task[];
}

export function BacklogView() {
  const { data: settings } = useSettings();
  const tz = settings?.timezone ?? "UTC";

  const [filter, setFilter] = useState<Filter>("OPEN");
  const { data: tasks, isLoading } = useTasks(
    filter === "ALL" ? {} : { status: filter as TaskStatus },
  );
  const { data: projects } = useProjects();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const startTimer = useStartTimer();

  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [section, setSection] = useState<TaskSection>("WORK");
  const [dueDate, setDueDate] = useState("");

  // Section first, then project inside it. Both sections are always rendered,
  // empty or not, so the split stays visible and you can see where a task lands.
  const grouped = useMemo(() => {
    const bySection = new Map<TaskSection, Map<string, ProjectGroup>>(
      SECTIONS.map((entry) => [entry.value, new Map<string, ProjectGroup>()]),
    );

    for (const task of tasks ?? []) {
      const projectsInSection = bySection.get(task.section);
      if (!projectsInSection) continue; // a section this build doesn't know about
      const bucket = projectsInSection.get(task.project.id) ?? {
        project: task.project,
        tasks: [],
      };
      bucket.tasks.push(task);
      projectsInSection.set(task.project.id, bucket);
    }

    return SECTIONS.map((entry) => {
      const groups = [...(bySection.get(entry.value)?.values() ?? [])].sort((a, b) =>
        a.project.name.localeCompare(b.project.name),
      );
      return {
        ...entry,
        groups,
        count: groups.reduce((sum, group) => sum + group.tasks.length, 0),
      };
    });
  }, [tasks]);

  const total = grouped.reduce((sum, entry) => sum + entry.count, 0);

  function addTask() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createTask.mutate(
      {
        name: trimmed,
        projectId: projectId || null,
        section,
        dueDate: dueDate || null,
      },
      {
        onSuccess: () => {
          setName("");
          setDueDate("");
          // The section is left as it was: adding several study tasks in a row
          // shouldn't mean re-picking it every time.
        },
      },
    );
  }

  const todayKey = toDayKey(new Date(), tz);

  return (
    <div className="py-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold">Backlog</h1>
        <div className="ml-auto flex gap-1">
          {(["OPEN", "DONE", "ALL"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "primary" : "ghost"}
              onClick={() => setFilter(value)}
            >
              {value === "OPEN" ? "Open" : value === "DONE" ? "Completed" : "All"}
            </Button>
          ))}
        </div>
      </div>

      {/* ---- Add form ---- */}
      <div className="mb-5 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            placeholder="What needs doing?"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addTask();
            }}
            className="flex-1"
          />
          <Select
            value={section}
            aria-label="Section"
            onChange={(event) => setSection(event.target.value as TaskSection)}
            className="sm:w-32"
          >
            {SECTIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.short}
              </option>
            ))}
          </Select>
          <Select
            value={projectId}
            aria-label="Project"
            onChange={(event) => setProjectId(event.target.value)}
            className="sm:w-40"
          >
            <option value="">Others</option>
            {(projects ?? [])
              .filter((project) => !project.isSystem)
              .map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
          </Select>
          <Input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className="sm:w-40"
          />
          <Button variant="primary" onClick={addTask} disabled={createTask.isPending}>
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : total === 0 ? (
        <EmptyState
          title={filter === "DONE" ? "Nothing completed yet" : "The backlog is empty"}
          hint="Add a task above. Starting one opens a timer linked to it, so the dashboard can show real time spent."
        />
      ) : (
        <div className="space-y-7">
          {grouped.map((sectionGroup) => (
            <section key={sectionGroup.value}>
              <div className="mb-2.5 flex items-baseline gap-2 border-b border-border pb-1.5">
                <h2 className="text-sm font-semibold">{sectionGroup.label}</h2>
                <span className="tabular text-xs text-fg-subtle">
                  {sectionGroup.count}
                </span>
              </div>

              {sectionGroup.groups.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-fg-subtle">
                  Nothing in {sectionGroup.short.toLowerCase()} yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {sectionGroup.groups.map(({ project, tasks: projectTasks }) => (
                    <div key={project.id}>
                      <h3 className="mb-1.5 flex items-center gap-2 text-sm font-medium text-fg-muted">
                        <ColorDot color={project.color} />
                        {project.name}
                        <span className="text-xs text-fg-subtle">
                          ({projectTasks.length})
                        </span>
                      </h3>

                      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                        {projectTasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            todayKey={todayKey}
                            onToggleStatus={() =>
                              updateTask.mutate({
                                id: task.id,
                                status: task.status === "DONE" ? "OPEN" : "DONE",
                              })
                            }
                            onMoveSection={() =>
                              updateTask.mutate({
                                id: task.id,
                                section: otherSection(task.section),
                              })
                            }
                            onStart={() =>
                              startTimer.mutate({
                                description: task.name,
                                projectId: task.project.id,
                                taskId: task.id,
                              })
                            }
                            onDelete={() => deleteTask.mutate(task.id)}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      <p className="mt-4 text-xs text-fg-subtle">
        Deleting a task keeps its logged time — only the link to the task is removed.
      </p>
    </div>
  );
}

function TaskRow({
  task,
  todayKey,
  onToggleStatus,
  onMoveSection,
  onStart,
  onDelete,
}: {
  task: Task;
  todayKey: string;
  onToggleStatus: () => void;
  onMoveSection: () => void;
  onStart: () => void;
  onDelete: () => void;
}) {
  const done = task.status === "DONE";
  const overdue = !done && task.dueDate !== null && task.dueDate < todayKey;

  return (
    <li className="flex items-center gap-2.5 px-3 py-2.5 transition hover:bg-surface-2">
      <button
        type="button"
        aria-label={done ? "Reopen task" : "Complete task"}
        onClick={onToggleStatus}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition",
          done ? "border-accent bg-accent text-accent-fg" : "border-border-strong hover:border-accent",
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : null}
      </button>

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm", done && "text-fg-subtle line-through")}>
          {task.name}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
          {task.dueDate ? (
            <span
              className={cn(
                "inline-flex items-center gap-1",
                overdue && "font-medium text-danger",
              )}
            >
              <CalendarDays className="h-3 w-3" />
              {task.dueDate}
            </span>
          ) : null}
          {task.loggedMinutes > 0 ? (
            <span className="tabular">{formatDurationHuman(task.loggedMinutes)} logged</span>
          ) : null}
        </div>
      </div>

      <IconButton
        label={`Move to ${shortLabel(otherSection(task.section))}`}
        onClick={onMoveSection}
      >
        <ArrowLeftRight className="h-4 w-4" />
      </IconButton>

      {!done ? (
        <IconButton
          label={`Start ${task.name}`}
          onClick={onStart}
          className="text-accent hover:bg-accent-soft"
        >
          <Play className="h-4 w-4 fill-current" />
        </IconButton>
      ) : (
        <IconButton label="Reopen task" onClick={onToggleStatus}>
          <Undo2 className="h-4 w-4" />
        </IconButton>
      )}

      <IconButton label="Delete task" variant="danger" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </li>
  );
}
