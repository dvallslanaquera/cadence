"use client";

import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, Check, Moon, Monitor, Plus, Sun, Trash2 } from "lucide-react";
import {
  useCreateProject,
  useDeleteProject,
  useProjects,
  useSettings,
  useUpdateProject,
  useUpdateSettings,
} from "@/lib/queries";
import { api } from "@/lib/api";
import { nextProjectColor, THEMES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ColorSwatchPicker } from "@/components/ui/ColorSwatchPicker";
import {
  Button,
  ColorDot,
  Field,
  IconButton,
  Input,
  Select,
  Spinner,
} from "@/components/ui/primitives";
import type { Project } from "@/lib/types";

/** A short list of common zones, plus whatever the browser reports. */
function timezoneOptions(current: string): string[] {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const common = [
    "Europe/Madrid",
    "Europe/London",
    "Europe/Berlin",
    "Europe/Lisbon",
    "America/New_York",
    "America/Los_Angeles",
    "America/Sao_Paulo",
    "Asia/Tokyo",
    "Australia/Sydney",
    "UTC",
  ];
  return [...new Set([current, browser, ...common].filter(Boolean))];
}

export function SettingsView() {
  const { data: settings, isLoading } = useSettings();
  const { data: projects } = useProjects(true);
  const updateSettings = useUpdateSettings();

  const [timezone, setTimezone] = useState("");
  const [dailyGoalHours, setDailyGoalHours] = useState(8);
  const [weeklyChartWeeks, setWeeklyChartWeeks] = useState(20);
  const [alertAfterHours, setAlertAfterHours] = useState(12);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [theme, setTheme] = useState("system");

  useEffect(() => {
    if (!settings) return;
    setTimezone(settings.timezone);
    setDailyGoalHours(settings.dailyGoalHours);
    setWeeklyChartWeeks(settings.weeklyChartWeeks);
    setAlertAfterHours(settings.alertAfterHours);
    setAlertsEnabled(settings.alertsEnabled);
    setTheme(settings.theme);
  }, [settings]);

  function pickTheme(id: string) {
    setTheme(id);
    // Apply at once so the recolour is instant; ThemeSync reconciles after the
    // refetch and keeps it in step with anything that changes the row elsewhere.
    const el = document.documentElement;
    if (id === "system") delete el.dataset.theme;
    else el.dataset.theme = id;
    updateSettings.mutate({ theme: id });
  }

  if (isLoading || !settings) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 py-4">
      <h1 className="text-lg font-semibold">Settings</h1>

      <ThemeSection theme={theme} onPick={pickTheme} />

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold">Home time zone</h2>
        <p className="mb-3 text-xs text-fg-muted">
          The week grid always renders in this zone, wherever you are. A 9am block stays a
          9am block, and weekly totals never shift when you travel.
        </p>

        <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">Runaway-timer alerts</p>
            <p className="text-xs text-fg-subtle">
              Email me once when a timer runs past the threshold below.
            </p>
          </div>
          <Switch
            checked={alertsEnabled}
            onChange={(next) => {
              setAlertsEnabled(next);
              updateSettings.mutate({ alertsEnabled: next });
            }}
            label="Runaway-timer alerts"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Time zone">
            <Select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
              {timezoneOptions(settings.timezone).map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Daily goal (hours)">
            <Input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={dailyGoalHours}
              onChange={(event) => setDailyGoalHours(Number(event.target.value))}
            />
          </Field>

          <Field label="Weeks in the weekly chart">
            <Input
              type="number"
              min={1}
              max={260}
              value={weeklyChartWeeks}
              onChange={(event) => setWeeklyChartWeeks(Number(event.target.value))}
            />
          </Field>

          <Field label="Email me if a timer runs past (hours)">
            <Input
              type="number"
              min={1}
              max={72}
              value={alertAfterHours}
              disabled={!alertsEnabled}
              onChange={(event) => setAlertAfterHours(Number(event.target.value))}
              className={cn("disabled:cursor-not-allowed disabled:opacity-50")}
            />
          </Field>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() =>
              updateSettings.mutate({
                timezone,
                dailyGoalHours,
                weeklyChartWeeks,
                alertAfterHours,
              })
            }
            disabled={updateSettings.isPending}
          >
            <Check className="h-4 w-4" />
            Save
          </Button>
          <span className="text-xs text-fg-subtle">
            Last alert check:{" "}
            {settings.lastAlertCheckAt
              ? new Date(settings.lastAlertCheckAt).toLocaleString()
              : "never — the scheduled workflow has not run yet"}
          </span>
        </div>
      </section>

      <ProjectSection projects={projects ?? []} />

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold">Runaway timer alert</h2>
        <p className="text-xs text-fg-muted">
          Nothing truncates a timer. A GitHub Actions schedule pings the app every 15
          minutes; if an entry has been running past the threshold above, you get one email
          — one per entry, ever, so a timer left running over a weekend does not send
          hundreds. The timer keeps running until you stop it.
        </p>
      </section>
    </div>
  );
}

function ProjectSection({ projects }: { projects: Project[] }) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();

  const [name, setName] = useState("");
  const [color, setColor] = useState(() => nextProjectColor([]));
  const [pendingDelete, setPendingDelete] = useState<{
    project: Project;
    entries: number;
    tasks: number;
  } | null>(null);

  useEffect(() => {
    setColor(nextProjectColor(projects.map((project) => project.color)));
  }, [projects]);

  async function confirmDelete(project: Project) {
    const { impact } = await api.get<{ impact: { entries: number; tasks: number } }>(
      `/api/projects/${project.id}`,
    );
    setPendingDelete({ project, ...impact });
  }

  const active = projects.filter((project) => !project.archived);
  const archived = projects.filter((project) => project.archived);

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1 text-sm font-semibold">Projects</h2>
      <p className="mb-3 text-xs text-fg-muted">
        Archiving hides a project from the pickers but keeps its history. Deleting moves its
        entries and tasks to Others — time data is never destroyed.
      </p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          placeholder="New project name"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && name.trim()) {
              createProject.mutate({ name: name.trim(), color }, { onSuccess: () => setName("") });
            }
          }}
          className="flex-1"
        />
        <div className="flex items-center">
          <ColorSwatchPicker color={color} onPick={setColor} />
        </div>
        <Button
          variant="primary"
          disabled={!name.trim() || createProject.isPending}
          onClick={() =>
            createProject.mutate({ name: name.trim(), color }, { onSuccess: () => setName("") })
          }
        >
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </div>

      <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {[...active, ...archived].map((project) => (
          <li
            key={project.id}
            className={cn(
              "flex items-center gap-2.5 px-3 py-2",
              project.archived && "opacity-60",
            )}
          >
            <ColorDot color={project.color} className="h-3 w-3" />
            <span className="min-w-0 flex-1 truncate text-sm">
              {project.name}
              {project.isSystem ? (
                <span className="ml-2 text-xs text-fg-subtle">system default</span>
              ) : null}
              {project.archived ? (
                <span className="ml-2 text-xs text-fg-subtle">archived</span>
              ) : null}
            </span>

            {!project.isSystem ? (
              <>
                <ColorSwatchPicker
                  size="sm"
                  color={project.color}
                  onPick={(c) => updateProject.mutate({ id: project.id, color: c })}
                />

                <IconButton
                  label={project.archived ? "Unarchive" : "Archive"}
                  onClick={() =>
                    updateProject.mutate({ id: project.id, archived: !project.archived })
                  }
                >
                  {project.archived ? (
                    <ArchiveRestore className="h-4 w-4" />
                  ) : (
                    <Archive className="h-4 w-4" />
                  )}
                </IconButton>

                <IconButton
                  label="Delete project"
                  variant="danger"
                  onClick={() => void confirmDelete(project)}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </>
            ) : null}
          </li>
        ))}
      </ul>

      {pendingDelete ? (
        <div className="mt-3 rounded-lg border border-danger/40 bg-danger-soft p-3">
          <p className="text-sm font-medium text-danger">
            Delete “{pendingDelete.project.name}”?
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            {pendingDelete.entries} time {pendingDelete.entries === 1 ? "entry" : "entries"} and{" "}
            {pendingDelete.tasks} {pendingDelete.tasks === 1 ? "task" : "tasks"} will move to
            Others. No time is lost.
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                deleteProject.mutate(pendingDelete.project.id);
                setPendingDelete(null);
              }}
            >
              Delete and reassign
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ThemeSection({
  theme,
  onPick,
}: {
  theme: string;
  onPick: (id: string) => void;
}) {
  const system = THEMES.find((t) => t.group === "system")!;
  const light = THEMES.filter((t) => t.group === "light");
  const dark = THEMES.filter((t) => t.group === "dark");

  function option(t: {
    id: string;
    label: string;
    swatches: { bg: string; surface: string; accent: string };
  }) {
    const selected = t.id === theme;
    return (
      <button
        key={t.id}
        type="button"
        onClick={() => onPick(t.id)}
        className={cn(
          "flex items-center gap-2.5 rounded-lg border p-2 text-left text-sm transition",
          selected ? "border-accent ring-1 ring-accent" : "border-border hover:bg-surface-2",
        )}
      >
        <span className="flex -space-x-1.5">
          <span
            className="h-4 w-4 rounded-full border border-border"
            style={{ background: t.swatches.bg }}
          />
          <span
            className="h-4 w-4 rounded-full border border-border"
            style={{ background: t.swatches.surface }}
          />
          <span
            className="h-4 w-4 rounded-full border border-border"
            style={{ background: t.swatches.accent }}
          />
        </span>
        <span className="min-w-0 flex-1 truncate">{t.label}</span>
        {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1 text-sm font-semibold">Theme</h2>
      <p className="mb-3 text-xs text-fg-muted">
        System follows your OS; the rest force a palette. Picked here, applied at once.
      </p>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => onPick(system.id)}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg border p-2 text-left text-sm transition",
            theme === system.id ? "border-accent ring-1 ring-accent" : "border-border hover:bg-surface-2",
          )}
        >
          <Monitor className="h-4 w-4 shrink-0 text-fg-muted" />
          <span className="min-w-0 flex-1 truncate">{system.label}</span>
          {theme === system.id ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
        </button>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            <Sun className="h-3.5 w-3.5" /> Light
          </p>
          <div className="grid gap-2 sm:grid-cols-2">{light.map(option)}</div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            <Moon className="h-3.5 w-3.5" /> Dark
          </p>
          <div className="grid gap-2 sm:grid-cols-2">{dark.map(option)}</div>
        </div>
      </div>
    </section>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition",
        checked ? "bg-accent" : "bg-border-strong",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-surface shadow transition",
          checked ? "translate-x-4" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
