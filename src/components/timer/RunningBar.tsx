"use client";

import { useRef, useState } from "react";
import { AlertTriangle, Play, Square } from "lucide-react";
import { useNow } from "@/lib/hooks";
import {
  useRunning,
  useSettings,
  useStartTimer,
  useStopTimer,
  useUpdateEntry,
} from "@/lib/queries";
import {
  dayKey,
  formatClock,
  formatElapsedWithSeconds,
  instantFromLocalParts,
  parseClockToMinutes,
} from "@/domain/time";
import { cn } from "@/lib/utils";
import { DescriptionInput } from "@/components/ui/DescriptionInput";
import { ProjectPicker } from "@/components/ui/ProjectPicker";
import { useT } from "@/lib/i18n-client";
import type { Entry } from "@/lib/types";
import { useCommitField } from "./useCommitField";

// Timer strip with live inputs (title, project, start time) so fixes cost one click. Turns amber past the alert threshold.
export function RunningBar() {
  const { data } = useRunning();
  const { data: settings } = useSettings();
  const start = useStartTimer();
  const stop = useStopTimer();
  const now = useNow(1000);
  const { t } = useT();

  const descriptionRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null);
  const entry = data?.entry ?? null;
  const tz = settings?.timezone ?? "UTC";

  // Type a name (or pick a recent one) before pressing play; startedAt defaults to now on the server. An empty draft still starts, so the old click-play-then-name flow keeps working.
  function startWithDraft() {
    if (start.isPending) return;
    const description = draft.trim();
    start.mutate(
      { description: description || undefined, projectId: draftProjectId ?? undefined },
      {
        onSuccess: () => {
          setDraft("");
          setDraftProjectId(null);
          requestAnimationFrame(() => descriptionRef.current?.focus());
        },
      },
    );
  }

  const elapsedMs = entry ? now.getTime() - new Date(entry.startedAt).getTime() : 0;
  const overdue = entry ? elapsedMs >= (data?.alertAfterHours ?? 12) * 3_600_000 : false;

  return (
    <div className="flex items-center gap-2 py-2">
      <div
        className={cn(
          "flex h-14 min-w-0 flex-1 items-center gap-1.5 rounded-xl border px-2.5",
          entry
            ? overdue
              ? "border-warning/40 bg-warning-soft"
              : "border-border bg-surface"
            : "border-dashed border-border bg-surface/50",
        )}
      >
        <PulseDot active={Boolean(entry)} overdue={overdue} />

        {entry ? (
          <RunningFields entry={entry} tz={tz} descriptionRef={descriptionRef} />
        ) : (
          <DescriptionInput
            openOnFocus
            value={draft}
            placeholder={t("timer.placeholder")}
            onChange={(value) => {
              setDraft(value);
              setDraftProjectId(null);
            }}
            onSelectSuggestion={(_description, projectId) => setDraftProjectId(projectId)}
            onSubmit={startWithDraft}
            onCancel={() => {
              setDraft("");
              setDraftProjectId(null);
            }}
            inputClassName={cn(
              "h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium",
              "placeholder:font-normal placeholder:text-fg-subtle",
              "transition hover:border-border focus:border-border focus:bg-surface focus:outline-none",
            )}
          />
        )}

        {entry ? (
          <span
            className={cn(
              "tabular shrink-0 px-1 text-sm font-semibold",
              overdue && "text-warning",
            )}
          >
            {formatElapsedWithSeconds(elapsedMs)}
          </span>
        ) : null}
      </div>

      {data?.schedulerStale ? <StaleSchedulerBadge /> : null}

      <button
        type="button"
        aria-label={entry ? t("timer.stop") : t("timer.start")}
        title={entry ? t("timer.stop") : t("timer.start")}
        onClick={() => (entry ? stop.mutate() : startWithDraft())}
        disabled={stop.isPending || start.isPending}
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl shadow-[var(--shadow)] transition",
          "hover:brightness-110 active:scale-95",
          "disabled:pointer-events-none disabled:opacity-50",
          entry
            ? "bg-danger text-white"
            : "bg-accent text-accent-fg",
        )}
      >
        {entry ? (
          <Square className="h-6 w-6 fill-current" />
        ) : (
          // Nudged right so the triangle looks centred, which it isn't when its bounding box is.
          <Play className="ml-0.5 h-7 w-7 fill-current" />
        )}
      </button>
    </div>
  );
}

// Each field holds keystrokes until commit; useRunning polls every 30s and would overwrite mid-typing.
function RunningFields({
  entry,
  tz,
  descriptionRef,
}: {
  entry: Entry;
  tz: string;
  descriptionRef: React.RefObject<HTMLInputElement | null>;
}) {
  const update = useUpdateEntry();
  const { t } = useT();

  const serverStartTime = formatClock(new Date(entry.startedAt), tz);

  const description = useCommitField(entry.description, (next) => {
    if (next === null || next.trim() === entry.description.trim()) return;
    update.mutate({ id: entry.id, description: next.trim() });
  });

  const startTime = useCommitField(serverStartTime, (next) => {
    if (next === null || next === serverStartTime) return;
    const minutes = parseClockToMinutes(next);
    if (minutes === null) return;
    // Keep the entry on its start day; only time of day is editable here, moving days is a grid drag.
    update.mutate({
      id: entry.id,
      startedAt: instantFromLocalParts(
        dayKey(new Date(entry.startedAt), tz),
        minutes,
        tz,
      ).toISOString(),
    });
  });

  return (
    <>
      <input
        ref={descriptionRef}
        placeholder={t("timer.placeholder")}
        {...description}
        className={cn(
          "h-8 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium",
          "placeholder:font-normal placeholder:text-fg-subtle",
          "transition hover:border-border focus:border-border focus:bg-surface focus:outline-none",
        )}
      />

      <ProjectPicker
        compact
        value={entry.project.id}
        fallback={entry.project}
        onChange={(projectId) => update.mutate({ id: entry.id, projectId })}
      />

      <input
        type="time"
        aria-label={t("timer.starttime")}
        {...startTime}
        className={cn(
          "tabular h-8 shrink-0 rounded-lg border border-transparent bg-transparent px-1.5 text-sm text-fg-muted",
          "transition hover:border-border focus:border-border focus:bg-surface focus:text-fg focus:outline-none",
        )}
      />
    </>
  );
}

function PulseDot({ active, overdue }: { active: boolean; overdue: boolean }) {
  if (!active) {
    return <span className="ml-1 h-2 w-2 shrink-0 rounded-full bg-border-strong" />;
  }
  return (
    <span className="relative ml-1 flex h-2 w-2 shrink-0">
      <span
        className={cn(
          "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
          overdue ? "bg-warning" : "bg-accent",
        )}
      />
      <span
        className={cn(
          "relative inline-flex h-2 w-2 rounded-full",
          overdue ? "bg-warning" : "bg-accent",
        )}
      />
    </span>
  );
}

// GitHub disables scheduled workflows after 60 days of repo inactivity, which would silently kill the runaway-timer email. See ARCHITECTURE.md §12.
function StaleSchedulerBadge() {
  const { t } = useT();
  return (
    <span
      title={t("alert.stale.title")}
      className="flex shrink-0 items-center gap-1 rounded-lg border border-warning/40 bg-warning-soft px-2 py-1 text-xs font-medium text-warning"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      <span className="hidden lg:inline">{t("alert.stale.badge")}</span>
    </span>
  );
}
