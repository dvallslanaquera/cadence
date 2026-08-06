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
import { APP_BUILD, APP_BUILD_DATE, APP_COMMIT, APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import { ColorSwatchPicker } from "@/components/ui/ColorSwatchPicker";
import { ExportSection } from "./ExportSection";
import { useT } from "@/lib/i18n-client";
import { LANGUAGES } from "@/lib/i18n";
import {
  Button,
  ColorDot,
  ErrorState,
  Field,
  IconButton,
  Input,
  Select,
  Spinner,
} from "@/components/ui/primitives";
import type { Project } from "@/lib/types";

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
  const { data: settings, isLoading, isError, refetch } = useSettings();
  const { data: projects } = useProjects(true);
  const updateSettings = useUpdateSettings();
  const { t } = useT();

  const [timezone, setTimezone] = useState("");
  const [dailyGoalHours, setDailyGoalHours] = useState(8);
  const [weeklyChartWeeks, setWeeklyChartWeeks] = useState(20);
  const [alertAfterHours, setAlertAfterHours] = useState(12);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [theme, setTheme] = useState("system");
  const [language, setLanguage] = useState("en");
  const [fontSize, setFontSize] = useState("default");

  useEffect(() => {
    if (!settings) return;
    setTimezone(settings.timezone);
    setDailyGoalHours(settings.dailyGoalHours);
    setWeeklyChartWeeks(settings.weeklyChartWeeks);
    setAlertAfterHours(settings.alertAfterHours);
    setAlertsEnabled(settings.alertsEnabled);
    setTheme(settings.theme);
    setLanguage(settings.language);
    setFontSize(settings.fontSize);
  }, [settings]);

  function pickTheme(id: string) {
    setTheme(id);
    // Apply immediately so the recolour is instant; ThemeSync reconciles after the refetch.
    const el = document.documentElement;
    if (id === "system") delete el.dataset.theme;
    else el.dataset.theme = id;
    updateSettings.mutate({ theme: id });
  }

  function pickFontSize(id: string) {
    setFontSize(id);
    // Apply immediately so the zoom is instant; FontSizeSync reconciles after the refetch.
    const el = document.documentElement;
    if (id === "default") delete el.dataset.fontsize;
    else el.dataset.fontsize = id;
    updateSettings.mutate({ fontSize: id });
  }

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // Settled with no row means the read failed; keep spinning and a dead API looks like a slow one.
  if (isError || !settings) {
    return (
      <div className="max-w-2xl py-4">
        <ErrorState
          title={t("error.title")}
          hint={t("error.hint")}
          retryLabel={t("error.retry")}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 py-4">
      <h1 className="text-lg font-semibold">{t("settings.heading")}</h1>

      <ThemeSection theme={theme} onPick={pickTheme} />

      <FontSizeSection fontSize={fontSize} onPick={pickFontSize} />

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold">{t("settings.language")}</h2>
        <Field label={t("settings.language")}>
          <Select
            value={language}
            onChange={(event) => {
              setLanguage(event.target.value);
              updateSettings.mutate({ language: event.target.value });
            }}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </Select>
        </Field>
      </section>

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold">{t("settings.timezone.title")}</h2>
        <p className="mb-3 text-xs text-fg-muted">{t("settings.timezone.copy")}</p>

        <div className="mb-3 flex items-center justify-between rounded-lg border border-border bg-surface-2 px-3 py-2">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t("settings.alerts.row")}</p>
            <p className="text-xs text-fg-subtle">{t("settings.alerts.rowHint")}</p>
          </div>
          <Switch
            checked={alertsEnabled}
            onChange={(next) => {
              setAlertsEnabled(next);
              updateSettings.mutate({ alertsEnabled: next });
            }}
            label={t("settings.alerts.row")}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("settings.field.timezone")}>
            <Select value={timezone} onChange={(event) => setTimezone(event.target.value)}>
              {timezoneOptions(settings.timezone).map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t("settings.field.dailyGoal")}>
            <Input
              type="number"
              min={0}
              max={24}
              step={0.5}
              value={dailyGoalHours}
              onChange={(event) => setDailyGoalHours(Number(event.target.value))}
            />
          </Field>

          <Field label={t("settings.field.weeks")}>
            <Input
              type="number"
              min={1}
              max={260}
              value={weeklyChartWeeks}
              onChange={(event) => setWeeklyChartWeeks(Number(event.target.value))}
            />
          </Field>

          <Field label={t("settings.field.alertAfter")}>
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
            {t("settings.save")}
          </Button>
          <span className="text-xs text-fg-subtle">
            {t("settings.lastCheck")}
            {settings.lastAlertCheckAt
              ? new Date(settings.lastAlertCheckAt).toLocaleString()
              : t("settings.never")}
          </span>
        </div>
      </section>

      <ProjectSection projects={projects ?? []} />

      {/* Remount on a saved zone change so the default range follows it. */}
      <ExportSection key={settings.timezone} tz={settings.timezone} />

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-1 text-sm font-semibold">{t("settings.alerts.title")}</h2>
        <p className="text-xs text-fg-muted">{t("settings.alerts.copy")}</p>
      </section>

      <AboutSection />
    </div>
  );
}

function AboutSection() {
  const { t } = useT();
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1 text-sm font-semibold">{t("about.title")}</h2>
      <p className="text-xs font-medium text-fg-muted">
        {t("about.version", { version: APP_VERSION, build: APP_BUILD })}
      </p>
      <p className="mt-0.5 text-xs text-fg-subtle">
        {APP_COMMIT || t("about.noCommit")}
        {APP_BUILD_DATE ? t("about.built", { date: APP_BUILD_DATE }) : ""}
      </p>
    </section>
  );
}

function ProjectSection({ projects }: { projects: Project[] }) {
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { t, plural } = useT();

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
      <h2 className="mb-1 text-sm font-semibold">{t("projects.title")}</h2>
      <p className="mb-3 text-xs text-fg-muted">{t("projects.copy")}</p>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={name}
          placeholder={t("projects.namePlaceholder")}
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
          {t("projects.add")}
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
                <span className="ml-2 text-xs text-fg-subtle">{t("projects.systemDefault")}</span>
              ) : null}
              {project.archived ? (
                <span className="ml-2 text-xs text-fg-subtle">{t("projects.archived")}</span>
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
                  label={project.archived ? t("projects.unarchive") : t("projects.archive")}
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
                  label={t("projects.delete")}
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
            {t("projects.deleteTitle", { name: pendingDelete.project.name })}
          </p>
          <p className="mt-1 text-xs text-fg-muted">
            {plural(
              pendingDelete.entries,
              "projects.deleteBody.one",
              "projects.deleteBody.other",
              {
                entries: plural(
                  pendingDelete.entries,
                  "common.entry.one",
                  "common.entry.other",
                ),
                tasks: plural(pendingDelete.tasks, "common.task.one", "common.task.other"),
              },
            )}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setPendingDelete(null)}>
              {t("projects.cancel")}
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                deleteProject.mutate(pendingDelete.project.id);
                setPendingDelete(null);
              }}
            >
              {t("projects.deleteReassign")}
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
  const { t } = useT();
  const system = THEMES.find((th) => th.group === "system")!;
  const light = THEMES.filter((th) => th.group === "light");
  const dark = THEMES.filter((th) => th.group === "dark");

  function option(th: {
    id: string;
    label: string;
    swatches: { bg: string; surface: string; accent: string };
  }) {
    const selected = th.id === theme;
    return (
      <button
        key={th.id}
        type="button"
        onClick={() => onPick(th.id)}
        className={cn(
          "flex items-center gap-2.5 rounded-lg border p-2 text-left text-sm transition",
          selected ? "border-accent ring-1 ring-accent" : "border-border hover:bg-surface-2",
        )}
      >
        <span className="flex -space-x-1.5">
          <span
            className="h-4 w-4 rounded-full border border-border"
            style={{ background: th.swatches.bg }}
          />
          <span
            className="h-4 w-4 rounded-full border border-border"
            style={{ background: th.swatches.surface }}
          />
          <span
            className="h-4 w-4 rounded-full border border-border"
            style={{ background: th.swatches.accent }}
          />
        </span>
        <span className="min-w-0 flex-1 truncate">{t(`theme.${th.id}`)}</span>
        {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
      </button>
    );
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1 text-sm font-semibold">{t("theme.title")}</h2>
      <p className="mb-3 text-xs text-fg-muted">{t("theme.copy")}</p>

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
          <span className="min-w-0 flex-1 truncate">{t(`theme.${system.id}`)}</span>
          {theme === system.id ? <Check className="h-3.5 w-3.5 shrink-0 text-accent" /> : null}
        </button>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            <Sun className="h-3.5 w-3.5" /> {t("theme.light")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">{light.map(option)}</div>
        </div>

        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-fg-subtle">
            <Moon className="h-3.5 w-3.5" /> {t("theme.dark")}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">{dark.map(option)}</div>
        </div>
      </div>
    </section>
  );
}

function FontSizeSection({
  fontSize,
  onPick,
}: {
  fontSize: string;
  onPick: (id: string) => void;
}) {
  const { t } = useT();
  const options = [
    { id: "small", label: t("settings.fontSize.small") },
    { id: "default", label: t("settings.fontSize.default") },
    { id: "large", label: t("settings.fontSize.large") },
  ];

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1 text-sm font-semibold">{t("settings.fontSize.title")}</h2>
      <p className="mb-3 text-xs text-fg-muted">{t("settings.fontSize.copy")}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((opt) => {
          const selected = opt.id === fontSize;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPick(opt.id)}
              className={cn(
                "rounded-lg border p-2 text-center text-sm transition",
                selected ? "border-accent ring-1 ring-accent" : "border-border hover:bg-surface-2",
              )}
            >
              {opt.label}
            </button>
          );
        })}
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
