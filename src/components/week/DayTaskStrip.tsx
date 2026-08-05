"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown, Play } from "lucide-react";
import { useLocalStorage } from "@/lib/hooks";
import { useUpdateTask } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { ColorDot } from "@/components/ui/primitives";
import { ProjectPicker } from "@/components/ui/ProjectPicker";
import { useT } from "@/lib/i18n-client";
import type { Task } from "@/lib/types";

// Expandable due-tasks menu under each weekday header; renders nothing on empty days so no empty row. See ARCHITECTURE.md §9.
export function DayTaskStrip({
  dayKey,
  tasks,
  onStart,
}: {
  dayKey: string;
  tasks: Task[];
  onStart: (task: Task) => void;
}) {
  const [open, setOpen] = useLocalStorage(`cadence:dayTasks:${dayKey}`, false);
  const updateTask = useUpdateTask();
  const { t } = useT();

  if (tasks.length === 0) return null;

  const remaining = tasks.filter((task) => task.status === "OPEN").length;
  const done = tasks.length;

  return (
    <Collapsible.Root open={open} onOpenChange={setOpen} className="mt-1">
      <Collapsible.Trigger
        className={cn(
          "flex w-full items-center justify-center gap-1 rounded-md px-1 py-0.5 text-[10px] font-medium transition",
          remaining > 0
            ? "bg-accent-soft text-accent hover:brightness-95"
            : "text-fg-subtle hover:bg-surface-2",
        )}
      >
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
        {remaining > 0 ? t("taskstrip.due", { n: remaining }) : t("taskstrip.done", { n: done })}
      </Collapsible.Trigger>

      <Collapsible.Content className="mt-1 space-y-1">
        {tasks.map((task) => (
          <div
            key={task.id}
            className="flex items-center gap-1 rounded-md border border-border bg-surface px-1.5 py-1"
          >
            {/* The row is the project control; the start button stays a separate target. */}
            <ProjectPicker
              value={task.project.id}
              fallback={task.project}
              onChange={(projectId) => updateTask.mutate({ id: task.id, projectId })}
              trigger={({ color, name }) => (
                <button
                  type="button"
                  title={t("taskstrip.changeProject", { name: task.name, project: name })}
                  className="flex min-w-0 flex-1 items-center gap-1 rounded px-0.5 py-0.5 text-left transition hover:bg-surface-2"
                >
                  <ColorDot color={color} />
                  <span
                    className={cn(
                      "min-w-0 flex-1 truncate text-[10px]",
                      task.status === "DONE" && "text-fg-subtle line-through",
                    )}
                  >
                    {task.name}
                  </span>
                </button>
              )}
            />
            {task.status === "OPEN" ? (
              <button
                type="button"
                aria-label={t("taskstrip.start", { name: task.name })}
                title={t("taskstrip.start", { name: task.name })}
                onClick={() => onStart(task)}
                className="shrink-0 rounded p-0.5 text-accent transition hover:bg-accent-soft"
              >
                <Play className="h-3 w-3 fill-current" />
              </button>
            ) : null}
          </div>
        ))}
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
