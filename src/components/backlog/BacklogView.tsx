"use client";

import { useMemo, useState } from "react";
import {
  AlignLeft,
  ArrowLeftRight,
  CalendarDays,
  Check,
  Play,
  Plus,
  Trash2,
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
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useT } from "@/lib/i18n-client";
import type { Project, Task, TaskSection } from "@/lib/types";

/**
 * The backlog's top-level split, in display order. A section is coarser than a
 * project and independent of it: the same project can hold tasks on both sides,
 * which is why this is a field on the task rather than on the project.
 */
const SECTIONS: { value: TaskSection; key: string }[] = [
  { value: "WORK", key: "work" },
  { value: "STUDY", key: "study" },
];

const otherSection = (section: TaskSection): TaskSection =>
  section === "WORK" ? "STUDY" : "WORK";

const sectionKey = (section: TaskSection): string =>
  SECTIONS.find((entry) => entry.value === section)?.key ?? "work";

interface ProjectGroup {
  project: Task["project"];
  tasks: Task[];
}

export function BacklogView() {
  const { data: settings } = useSettings();
  const tz = settings?.timezone ?? "UTC";
  const { t } = useT();

  const { data: tasks, isLoading } = useTasks({});
  const { data: projects } = useProjects();

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const startTimer = useStartTimer();

  const [name, setName] = useState("");
  const [projectId, setProjectId] = useState("");
  const [section, setSection] = useState<TaskSection>("WORK");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<Task | null>(null);

  // Open tasks split into Work/Study. Completed tasks drop out of that split
  // into their own bucket below, since once they're done the section is just a
  // place to send them back to, not where they live.
  const { openSections, completedGroups, completedCount } = useMemo(() => {
    const bySection = new Map<TaskSection, Map<string, ProjectGroup>>(
      SECTIONS.map((entry) => [entry.value, new Map<string, ProjectGroup>()]),
    );
    const completed = new Map<string, ProjectGroup>();

    for (const task of tasks ?? []) {
      const bucket = (map: Map<string, ProjectGroup>) =>
        map.get(task.project.id) ?? { project: task.project, tasks: [] };

      if (task.status === "DONE") {
        const group = bucket(completed);
        group.tasks.push(task);
        completed.set(task.project.id, group);
        continue;
      }

      const projectsInSection = bySection.get(task.section);
      if (!projectsInSection) continue; // a section this build doesn't know about
      const group = bucket(projectsInSection);
      group.tasks.push(task);
      projectsInSection.set(task.project.id, group);
    }

    const sortGroups = (groups: ProjectGroup[]) =>
      groups.sort((a, b) => a.project.name.localeCompare(b.project.name));

    const openSections = SECTIONS.map((entry) => {
      const groups = sortGroups([...(bySection.get(entry.value)?.values() ?? [])]);
      return {
        ...entry,
        groups,
        count: groups.reduce((sum, group) => sum + group.tasks.length, 0),
      };
    });
    const completedGroups = sortGroups([...completed.values()]);
    const completedCount = completedGroups.reduce(
      (sum, group) => sum + group.tasks.length,
      0,
    );
    return { openSections, completedGroups, completedCount };
  }, [tasks]);

  const total = openSections.reduce((sum, entry) => sum + entry.count, 0) + completedCount;

  function addTask() {
    const trimmed = name.trim();
    if (!trimmed) return;
    createTask.mutate(
      {
        name: trimmed,
        notes: notes.trim() || null,
        projectId: projectId || null,
        section,
        dueDate: dueDate || null,
      },
      {
        onSuccess: () => {
          setName("");
          setDueDate("");
          setNotes("");
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
        <h1 className="text-lg font-semibold">{t("backlog.heading")}</h1>
      </div>

      {/* ---- Add form ---- */}
      <div className="mb-5 rounded-xl border border-border bg-surface p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            placeholder={t("backlog.placeholder")}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addTask();
            }}
            className="flex-1"
          />
          <Select
            value={section}
            aria-label={t("backlog.sectionAria")}
            onChange={(event) => setSection(event.target.value as TaskSection)}
            className="sm:w-32"
          >
            {SECTIONS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {t(`backlog.sectionShort.${entry.key}`)}
              </option>
            ))}
          </Select>
          <Select
            value={projectId}
            aria-label={t("backlog.projectAria")}
            onChange={(event) => setProjectId(event.target.value)}
            className="sm:w-40"
          >
            <option value="">{t("common.others")}</option>
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
          <IconButton
            label={t("backlog.addDesc")}
            variant={showNotes || notes ? "secondary" : "ghost"}
            onClick={() => setShowNotes((prev) => !prev)}
          >
            <AlignLeft className="h-4 w-4" />
          </IconButton>
          <Button variant="primary" onClick={addTask} disabled={createTask.isPending}>
            <Plus className="h-4 w-4" />
            {t("backlog.add")}
          </Button>
        </div>
        {showNotes ? (
          <textarea
            value={notes}
            placeholder={t("backlog.notesPlaceholder")}
            onChange={(event) => setNotes(event.target.value)}
            className="mt-2 h-20 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-fg-subtle focus:outline-none"
          />
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : total === 0 ? (
        <EmptyState
          title={t("backlog.empty.title")}
          hint={t("backlog.empty.hint")}
        />
      ) : (
        <div className="space-y-7">
          {openSections.map((sectionGroup) => (
            <section key={sectionGroup.value}>
              <div className="mb-2.5 flex items-baseline gap-2 border-b border-border pb-1.5">
                <h2 className="text-sm font-semibold">
                  {t(`backlog.section.${sectionGroup.key}`)}
                </h2>
                <span className="tabular text-xs text-fg-subtle">
                  {sectionGroup.count}
                </span>
              </div>

              {sectionGroup.groups.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-fg-subtle">
                  {t("backlog.emptySection", {
                    section: t(`backlog.sectionShort.${sectionGroup.key}`),
                  })}
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
                            projects={projects}
                            isEditing={editingId === task.id}
                            onBeginEdit={() => setEditingId(task.id)}
                            onCancelEdit={() => setEditingId(null)}
                            onUpdate={(patch) =>
                              updateTask.mutate(
                                { id: task.id, ...patch },
                                { onSuccess: () => setEditingId(null) },
                              )
                            }
                            onToggleStatus={() => setConfirmComplete(task)}
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

          {/* ---- Completed ---- */}
          <section>
            <div className="mb-2.5 flex items-baseline gap-2 border-b border-border pb-1.5">
              <h2 className="text-sm font-semibold">{t("backlog.completed")}</h2>
              <span className="tabular text-xs text-fg-subtle">{completedCount}</span>
            </div>

            {completedCount === 0 ? (
              <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-xs text-fg-subtle">
                {t("backlog.completedEmpty")}
              </p>
            ) : (
              <div className="space-y-4">
                {completedGroups.map(({ project, tasks: projectTasks }) => (
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
                          projects={projects}
                          isEditing={editingId === task.id}
                          onBeginEdit={() => setEditingId(task.id)}
                          onCancelEdit={() => setEditingId(null)}
                          onUpdate={(patch) =>
                            updateTask.mutate(
                              { id: task.id, ...patch },
                              { onSuccess: () => setEditingId(null) },
                            )
                          }
                          onMoveToSection={(section) =>
                            updateTask.mutate({ id: task.id, status: "OPEN", section })
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
        </div>
      )}

      <ConfirmDialog
        open={confirmComplete !== null}
        title={t("backlog.confirm.title")}
        description={
          confirmComplete
            ? t("backlog.confirm.body", { name: confirmComplete.name })
            : undefined
        }
        confirmLabel={t("backlog.confirm.confirm")}
        cancelLabel={t("backlog.confirm.cancel")}
        onConfirm={() => {
          if (confirmComplete) {
            updateTask.mutate({ id: confirmComplete.id, status: "DONE" });
          }
          setConfirmComplete(null);
        }}
        onCancel={() => setConfirmComplete(null)}
      />
    </div>
  );
}

function TaskRow({
  task,
  todayKey,
  projects,
  isEditing,
  onBeginEdit,
  onCancelEdit,
  onUpdate,
  onToggleStatus,
  onMoveSection,
  onMoveToSection,
  onStart,
  onDelete,
}: {
  task: Task;
  todayKey: string;
  projects: Project[] | undefined;
  isEditing: boolean;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (patch: {
    name?: string;
    notes?: string | null;
    projectId?: string | null;
    section?: TaskSection;
    dueDate?: string | null;
  }) => void;
  // Open-row actions.
  onToggleStatus?: () => void;
  onMoveSection?: () => void;
  onStart?: () => void;
  // Completed-row action: reopen straight into the chosen backlog.
  onMoveToSection?: (section: TaskSection) => void;
  onDelete: () => void;
}) {
  const { t } = useT();

  if (isEditing) {
    return (
      <li className="px-3 py-2.5">
        <TaskEditForm
          task={task}
          projects={projects}
          onSave={onUpdate}
          onCancel={onCancelEdit}
        />
      </li>
    );
  }

  const done = task.status === "DONE";
  const overdue = !done && task.dueDate !== null && task.dueDate < todayKey;

  const body = (
    <div
      className="min-w-0 flex-1 cursor-text"
      onDoubleClick={onBeginEdit}
      title={t("backlog.taskRowHint")}
    >
      <p className={cn("truncate text-sm", done && "text-fg-subtle line-through")}>
        {task.name}
      </p>
      {task.notes ? (
        <p className="mt-0.5 line-clamp-2 text-xs text-fg-subtle">{task.notes}</p>
      ) : null}
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
          <span className="tabular">
            {t("backlog.logged", { n: formatDurationHuman(task.loggedMinutes) })}
          </span>
        ) : null}
      </div>
    </div>
  );

  if (done) {
    return (
      <li className="flex items-center gap-2.5 px-3 py-2.5 transition hover:bg-surface-2">
        <span
          aria-label={t("backlog.completedBadge")}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-accent bg-accent text-accent-fg"
        >
          <Check className="h-3.5 w-3.5" />
        </span>
        {body}
        {SECTIONS.map((entry) => (
          <Button
            key={entry.value}
            size="sm"
            variant={task.section === entry.value ? "secondary" : "ghost"}
            onClick={() => onMoveToSection?.(entry.value)}
            title={t("backlog.reopen", { section: t(`backlog.section.${entry.key}`) })}
          >
            {t(`backlog.sectionShort.${entry.key}`)}
          </Button>
        ))}
        <IconButton label={t("backlog.deleteTask")} variant="danger" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2.5 px-3 py-2.5 transition hover:bg-surface-2">
      <button
        type="button"
        aria-label={t("backlog.completeTask")}
        onClick={onToggleStatus}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border-strong transition hover:border-accent"
      >
      </button>

      {body}

      <IconButton
        label={t("backlog.moveTo", {
          section: t(`backlog.sectionShort.${sectionKey(otherSection(task.section))}`),
        })}
        onClick={onMoveSection}
      >
        <ArrowLeftRight className="h-4 w-4" />
      </IconButton>

      <IconButton
        label={t("backlog.start", { name: task.name })}
        onClick={onStart}
        className="text-accent hover:bg-accent-soft"
      >
        <Play className="h-4 w-4 fill-current" />
      </IconButton>

      <IconButton label={t("backlog.deleteTask")} variant="danger" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </li>
  );
}

function TaskEditForm({
  task,
  projects,
  onSave,
  onCancel,
}: {
  task: Task;
  projects: Project[] | undefined;
  onSave: (patch: {
    name?: string;
    notes?: string | null;
    projectId?: string | null;
    section?: TaskSection;
    dueDate?: string | null;
  }) => void;
  onCancel: () => void;
}) {
  // The select uses "" for the system "Others" project. A task whose project is
  // that one therefore shows the empty option, and saving maps "" back to null.
  const othersId = (projects ?? []).find((project) => project.isSystem)?.id;
  const seededProjectId =
    task.project.id === othersId ? "" : task.project.id;

  const [name, setName] = useState(task.name);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [section, setSection] = useState<TaskSection>(task.section);
  const [projectId, setProjectId] = useState(seededProjectId);
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const { t } = useT();

  function save() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSave({
      name: trimmed,
      notes: notes.trim() || null,
      projectId: projectId || null,
      section,
      dueDate: dueDate || null,
    });
  }

  return (
    <div className="space-y-2">
      <Input
        value={name}
        placeholder={t("backlog.edit.namePlaceholder")}
        autoFocus
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") save();
          if (event.key === "Escape") onCancel();
        }}
        className="flex-1"
      />
      <div className="flex flex-wrap gap-2">
        <Select
          value={section}
          aria-label={t("backlog.edit.sectionAria")}
          onChange={(event) => setSection(event.target.value as TaskSection)}
          className="w-32"
        >
          {SECTIONS.map((entry) => (
            <option key={entry.value} value={entry.value}>
              {t(`backlog.sectionShort.${entry.key}`)}
            </option>
          ))}
        </Select>
        <Select
          value={projectId}
          aria-label={t("backlog.edit.projectAria")}
          onChange={(event) => setProjectId(event.target.value)}
          className="w-40"
        >
          <option value="">{t("common.others")}</option>
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
          className="w-40"
        />
      </div>
      <textarea
        value={notes}
        placeholder={t("backlog.notesPlaceholder")}
        onChange={(event) => setNotes(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel();
        }}
        className="h-20 w-full resize-y rounded-lg border border-border bg-surface px-3 py-2 text-sm placeholder:text-fg-subtle focus:outline-none"
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onCancel}>
          {t("backlog.edit.cancel")}
        </Button>
        <Button size="sm" variant="primary" onClick={save}>
          {t("backlog.edit.save")}
        </Button>
      </div>
    </div>
  );
}
