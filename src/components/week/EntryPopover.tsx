"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Square, Trash2 } from "lucide-react";
import {
  useDeleteEntry,
  useProjects,
  useSettings,
  useStopTimer,
  useUpdateEntry,
} from "@/lib/queries";
import {
  daysBetweenDateKeys,
  formatClock,
  formatDateISO,
  formatMinutesAsClock,
  instantFromLocalParts,
  parseClockToMinutes,
  shiftDateKey,
  wallClockMinutes,
} from "@/domain/time";
import { Button, ColorDot, Field, IconButton, Input } from "@/components/ui/primitives";
import { DescriptionInput } from "@/components/ui/DescriptionInput";
import { ProjectPicker } from "@/components/ui/ProjectPicker";
import { TimeInput } from "@/components/ui/TimeInput";
import { ClockRangePicker, type ClockHandle } from "@/components/ui/ClockRangePicker";
import { seriesColor } from "@/lib/constants";
import { useMediaQuery } from "@/lib/hooks";
import { useT } from "@/lib/i18n-client";
import type { Entry } from "@/lib/types";

const MINUTES_PER_DAY = 1440;

// End at or before start wraps to the next day; the dial only says "17:30", so this mirrors the grid's midnight wrap.
function wrapEndOffset(startMinutes: number, endMinutes: number): number {
  return endMinutes > startMinutes ? 0 : 1;
}

interface EntryFields {
  description: string;
  projectId: string;
  tags: string;
  // The start's calendar day anchors the entry; you move days by dragging in the grid, so only times are editable here.
  startDate: string;
  startTime: string;
  endTime: string;
  // Day offset seeded from the entry so multi-day survives a read; editing either time re-derives it as a single wrap.
  endDayOffset: number;
}

function entryFields(entry: Entry, tz: string): EntryFields {
  const startedAt = new Date(entry.startedAt);
  const endedAt = entry.endedAt ? new Date(entry.endedAt) : null;
  const startDate = formatDateISO(startedAt, tz);

  return {
    description: entry.description,
    projectId: entry.project.id,
    tags: entry.tags.join(", "),
    startDate,
    startTime: formatClock(startedAt, tz),
    endTime: endedAt ? formatClock(endedAt, tz) : "",
    endDayOffset: endedAt ? daysBetweenDateKeys(startDate, formatDateISO(endedAt, tz)) : 0,
  };
}

/** Keep my edit; take the entry's value only where I have not typed anything. */
function keepEdit<T>(mine: T, was: T, theirs: T): T {
  return mine === was ? theirs : mine;
}

// One editor for every grid path (start, create, edit) so they can't drift apart. See ARCHITECTURE.md §8.
export function EntryPopover({
  entry,
  onClose,
  onSuggestionsOpenChange,
}: {
  entry: Entry;
  onClose: () => void;
  // From the description field; the shell needs to know a dropdown is up so Escape dismisses it first. See EntryBlock.
  onSuggestionsOpenChange?: (open: boolean) => void;
}) {
  const { data: settings } = useSettings();
  const { data: projects } = useProjects();
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const stop = useStopTimer();

  const tz = settings?.timezone ?? "UTC";
  const running = entry.endedAt === null;
  const isDark = useMediaQuery("(prefers-color-scheme: dark)");
  const { t } = useT();

  const [form, setForm] = useState(() => entryFields(entry, tz));
  const { description, projectId, tags, startDate, startTime, endTime, endDayOffset } = form;

  // The entry shifts under the open editor (server rounding, refetch, another device stopping the timer). Untouched fields follow; edited ones don't, so a blind reset on our own in-flight create would lose what you typed.
  const derived = useMemo(() => entryFields(entry, tz), [entry, tz]);
  const synced = useRef(derived);

  useEffect(() => {
    const previous = synced.current;
    if (previous === derived) return;
    synced.current = derived;

    setForm((current) => ({
      description: keepEdit(current.description, previous.description, derived.description),
      projectId: keepEdit(current.projectId, previous.projectId, derived.projectId),
      tags: keepEdit(current.tags, previous.tags, derived.tags),
      startDate: keepEdit(current.startDate, previous.startDate, derived.startDate),
      startTime: keepEdit(current.startTime, previous.startTime, derived.startTime),
      endTime: keepEdit(current.endTime, previous.endTime, derived.endTime),
      endDayOffset: keepEdit(
        current.endDayOffset,
        previous.endDayOffset,
        derived.endDayOffset,
      ),
    }));
  }, [derived]);

  // Parsed time fields; null while cleared/half-typed. The dial holds the entry's own time so clearing doesn't yank a handle to midnight.
  // A running entry's empty end is a state, not a mode: leave empty to keep running, type to stop. The dial shows a dashed stub then a real arc.
  const parsedStart = parseClockToMinutes(startTime);
  const parsedEnd = parseClockToMinutes(endTime);
  const dialStart = parsedStart ?? wallClockMinutes(new Date(entry.startedAt), tz);
  const dialEnd =
    parsedEnd ?? (entry.endedAt ? wallClockMinutes(new Date(entry.endedAt), tz) : null);
  const spanMinutes =
    parsedStart === null || parsedEnd === null
      ? undefined
      : endDayOffset * MINUTES_PER_DAY + parsedEnd - parsedStart;

  function edit(patch: Partial<EntryFields>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  /** A dial drag writes back into the same two fields the inputs edit. */
  function onDialChange(handle: ClockHandle, minutes: number) {
    const clock = formatMinutesAsClock(minutes);
    if (handle === "start") {
      edit({
        startTime: clock,
        ...(parsedEnd === null ? {} : { endDayOffset: wrapEndOffset(minutes, parsedEnd) }),
      });
    } else {
      edit({
        endTime: clock,
        ...(parsedStart === null ? {} : { endDayOffset: wrapEndOffset(parsedStart, minutes) }),
      });
    }
  }

  function onStartTimeInput(value: string) {
    const minutes = parseClockToMinutes(value);
    edit({
      startTime: value,
      ...(minutes === null || parsedEnd === null
        ? {}
        : { endDayOffset: wrapEndOffset(minutes, parsedEnd) }),
    });
  }

  function onEndTimeInput(value: string) {
    const minutes = parseClockToMinutes(value);
    edit({
      endTime: value,
      ...(minutes === null || parsedStart === null
        ? {}
        : { endDayOffset: wrapEndOffset(parsedStart, minutes) }),
    });
  }

  function save() {
    const startMinutes = parseClockToMinutes(startTime);
    if (startMinutes === null) return;

    const payload: Parameters<typeof update.mutate>[0] = {
      id: entry.id,
      description: description.trim(),
      projectId,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      startedAt: instantFromLocalParts(startDate, startMinutes, tz).toISOString(),
    };

    const endMinutes = parseClockToMinutes(endTime);
    // Refuse a half-typed end like a bad start; empty means no end, so running keeps running and finished keeps its end.
    if (endMinutes === null && endTime.trim() !== "") return;

    if (endMinutes !== null) {
      // Offset 0 with end <= start would be a zero/negative entry; that belongs to the next day.
      const offset =
        endDayOffset === 0 ? wrapEndOffset(startMinutes, endMinutes) : endDayOffset;
      payload.endedAt = instantFromLocalParts(
        shiftDateKey(startDate, offset),
        endMinutes,
        tz,
      ).toISOString();
    }

    update.mutate(payload, { onSuccess: onClose });
  }

  const projectOptions = projects ?? [];

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2">
        <DescriptionInput
          autoFocus
          value={description}
          placeholder={t("timer.placeholder")}
          onChange={(value) => edit({ description: value })}
          onSelectSuggestion={(_description, projectId) => {
            // Null project means the usual project was retired; leave the current one rather than guess.
            if (projectId) edit({ projectId });
          }}
          onSubmit={save}
          onCancel={onClose}
          onOpenChange={onSuggestionsOpenChange}
        />
        <IconButton
          label={t("entry.delete")}
          variant="danger"
          onClick={() => {
            remove.mutate(entry);
            onClose();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      <div className="space-y-2">
        <Field label={t("entry.project")} as="div">
          <ProjectPicker
            value={projectId}
            onChange={(value) => edit({ projectId: value })}
            fallback={entry.project}
          />
        </Field>
      </div>

      <ClockRangePicker
        startMinutes={dialStart}
        endMinutes={dialEnd}
        spanMinutes={spanMinutes}
        onChange={onDialChange}
        color={seriesColor(
          projectOptions.find((p) => p.id === projectId)?.color ?? entry.project.color,
          isDark,
        )}
      />

      <div className="grid grid-cols-2 gap-2">
        <Field label={t("entry.start")}>
          <TimeInput
            value={startTime}
            fallback={formatClock(new Date(entry.startedAt), tz)}
            onChange={onStartTimeInput}
          />
        </Field>

        <Field label={t("entry.end")}>
          <div className="relative">
            <TimeInput
              value={endTime}
              // Empty means no end: a running entry left alone keeps running.
              fallback={entry.endedAt ? formatClock(new Date(entry.endedAt), tz) : ""}
              placeholder={running ? t("entry.running") : "17:00"}
              onChange={onEndTimeInput}
            />
            {/* The dial cannot show which day the end landed on, so say it. */}
            {endDayOffset > 0 ? (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-accent-soft px-1 py-0.5 text-[10px] font-medium text-accent">
                +{t("entry.endDayOffset", { n: endDayOffset })}
              </span>
            ) : null}
          </div>
        </Field>
      </div>

      {/* One-click stop for the common case; the end field above handles a specific minute. */}
      {running ? (
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={() => stop.mutate(undefined, { onSuccess: onClose })}
          disabled={stop.isPending}
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          {t("entry.stopNow")}
        </Button>
      ) : null}

      <Field label={t("entry.tags")}>
        <Input
          value={tags}
          placeholder={t("entry.tagsPlaceholder")}
          onChange={(event) => edit({ tags: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
          }}
        />
      </Field>

      <div className="flex items-center justify-between pt-1">
        <span className="flex items-center gap-1.5 text-xs text-fg-subtle">
          <ColorDot
            color={projectOptions.find((p) => p.id === projectId)?.color ?? entry.project.color}
          />
          {projectOptions.find((p) => p.id === projectId)?.name ?? entry.project.name}
        </span>
        <div className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={onClose}>
            {t("entry.cancel")}
          </Button>
          <Button size="sm" variant="primary" onClick={save} disabled={update.isPending}>
            {t("entry.save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
