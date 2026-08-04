"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown, Plus } from "lucide-react";
import { FREQUENT_PROJECT_COUNT, nextProjectColor, PROJECT_COLORS } from "@/lib/constants";
import { useCreateProject, useFrequentProjectIds, useProjects, useUpdateProject } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Button, ColorDot, Input } from "./primitives";
import { ColorSwatchPicker } from "./ColorSwatchPicker";
import { useT } from "@/lib/i18n-client";
import type { Project } from "@/lib/types";

/**
 * Project selection for the entry editor.
 *
 * Opens on the handful of projects actually in use rather than the full
 * alphabetical list, because picking a project is the one field you touch on
 * every entry. The complete list stays below the shortlist so nothing becomes
 * unreachable once you pass five projects, and a new project can be created
 * without leaving the entry you are editing.
 */
export function ProjectPicker({
  value,
  onChange,
  fallback,
  compact,
  trigger,
}: {
  value: string;
  onChange: (projectId: string) => void;
  /** Shown before the projects list has loaded. */
  fallback?: { name: string; color: string };
  /**
   * Chip rather than form field: no border until hovered, sized to its label.
   * For the running bar, where it sits inline between two borderless inputs.
   */
  compact?: boolean;
  /**
   * Supply the whole trigger instead of the default chip — for rows that are
   * themselves the control, like a due task whose name opens its project list.
   * Must render exactly one focusable element; it receives the current project.
   */
  trigger?: (project: { name: string; color: string }) => ReactNode;
}) {
  const { data: projects } = useProjects();
  const { data: frequentIds } = useFrequentProjectIds();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { t } = useT();

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(PROJECT_COLORS[0]);
  const listRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => projects ?? [], [projects]);

  const { frequent, rest } = useMemo(() => {
    const byId = new Map(all.map((project) => [project.id, project]));
    const top = (frequentIds ?? [])
      .map((id) => byId.get(id))
      .filter((project): project is Project => Boolean(project))
      .slice(0, FREQUENT_PROJECT_COUNT);
    const topIds = new Set(top.map((project) => project.id));
    return { frequent: top, rest: all.filter((project) => !topIds.has(project.id)) };
  }, [all, frequentIds]);

  const selected = all.find((project) => project.id === value);
  const label = selected?.name ?? fallback?.name ?? "…";
  const color = selected?.color ?? fallback?.color ?? PROJECT_COLORS[0];

  function choose(projectId: string) {
    onChange(projectId);
    setOpen(false);
    setCreating(false);
    setNewName("");
  }

  function create() {
    const name = newName.trim();
    if (!name) return;

    // Reuse rather than fail on the unique-name constraint.
    const existing = all.find(
      (project) => project.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      choose(existing.id);
      return;
    }

    createProject.mutate(
      { name, color: newColor },
      { onSuccess: (result) => choose(result.project.id) },
    );
  }

  function row(project: Project) {
    const isSelected = project.id === value;
    return (
      <div
        key={project.id}
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        onClick={() => choose(project.id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            choose(project.id);
          }
        }}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition",
          isSelected ? "bg-accent-soft text-accent" : "text-fg hover:bg-surface-2",
        )}
      >
        <ColorSwatchPicker
          color={project.color}
          onPick={(color) => updateProject.mutate({ id: project.id, color })}
        />
        <span className="min-w-0 flex-1 truncate">{project.name}</span>
        {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
      </div>
    );
  }

  return (
    <Popover.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setCreating(false);
          setNewName("");
          setNewColor(PROJECT_COLORS[0]);
        }
      }}
    >
      <Popover.Trigger asChild>
        {trigger ? (
          trigger({ name: label, color })
        ) : (
          <button
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-lg text-sm transition",
              compact
                ? "h-8 max-w-[168px] shrink border border-transparent px-2 text-fg-muted hover:border-border hover:bg-surface-2 hover:text-fg"
                : "h-9 w-full border border-border bg-surface px-2.5 hover:bg-surface-2",
            )}
          >
            <ColorDot color={color} />
            <span className="min-w-0 flex-1 truncate text-left">{label}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />
          </button>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={12}
          className="z-[60] w-[min(260px,calc(100vw-24px))] rounded-xl border border-border bg-surface p-1.5 shadow-[var(--shadow)]"
        >
          {frequent.length > 0 ? (
            <>
              <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
                {t("project.frequent")}
              </p>
              {frequent.map(row)}
            </>
          ) : null}

          {rest.length > 0 ? (
            <>
              {frequent.length > 0 ? (
                <p className="mt-1 border-t border-border px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-fg-subtle">
                  {t("project.all")}
                </p>
              ) : null}
              <div ref={listRef} className="scroll-thin max-h-44 overflow-y-auto">
                {rest.map(row)}
              </div>
            </>
          ) : null}

          <div className="mt-1 border-t border-border pt-1.5">
            {creating ? (
              <div className="flex items-center gap-1.5 px-0.5 pb-0.5">
                <ColorSwatchPicker color={newColor} onPick={setNewColor} />
                <Input
                  autoFocus
                  value={newName}
                  placeholder={t("project.namePlaceholder")}
                  maxLength={80}
                  className="h-8 flex-1 text-sm"
                  onChange={(event) => setNewName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      create();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="primary"
                  onClick={create}
                  disabled={!newName.trim() || createProject.isPending}
                >
                  {t("project.add")}
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setCreating(true);
                  setNewColor(nextProjectColor(all.map((project) => project.color)));
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-fg-muted transition hover:bg-surface-2 hover:text-fg"
              >
                <Plus className="h-3.5 w-3.5" />
                {t("project.newProject")}
              </button>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
