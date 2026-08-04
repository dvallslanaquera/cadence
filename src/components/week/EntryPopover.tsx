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

/**
 * Which local day the end falls on, given only two times of day. The dial can
 * only say "17:30", so an end at or before the start is read as the next day —
 * the same wrap the grid already applies to a block dragged past midnight.
 */
function wrapEndOffset(startMinutes: number, endMinutes: number): number {
  return endMinutes > startMinutes ? 0 : 1;
}

interface EntryFields {
  description: string;
  projectId: string;
  tags: string;
  /**
   * The start's calendar day anchors the entry. It has no control of its own —
   * the entry already sits on a day in the grid, and you move it by dragging it
   * there. Only the times are editable here.
   */
  startDate: string;
  startTime: string;
  endTime: string;
  /**
   * Days from the start's day to the end's day. Seeded from the entry so an
   * existing multi-day entry survives being merely looked at; editing either
   * time re-derives it as a single wrap, which is all a 24-hour dial can mean.
   */
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

/**
 * One editor for every path in and out of the grid — click-to-start,
 * drag-to-create, and editing an existing entry all land here, so the create
 * and edit paths cannot drift apart. See ARCHITECTURE.md §8.
 */
export function EntryPopover({
  entry,
  onClose,
  onSuggestionsOpenChange,
}: {
  entry: Entry;
  onClose: () => void;
  /**
   * Passed through from the description field. The popover shell needs to know a
   * dropdown is up so Escape dismisses that first. See EntryBlock.
   */
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

  /**
   * The entry changes beneath the open editor more often than it looks. The
   * server's rounding can land on a block you just created. A refetch hands back
   * a fresh object. Another device may stop the timer. Untouched fields follow
   * it, edited ones do not. This editor is now open while its own create is
   * still in the air, and a blind reset there throws away what you typed.
   */
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

  // Parsed views of the two time fields. Null while a field is cleared or
  // half-typed; the dial holds the entry's own time rather than snapping to
  // midnight, so clearing the input doesn't yank a handle across the face.
  //
  // A running entry has no end *yet*, which is the same field in a different
  // state rather than a different mode: leave it empty and the timer keeps
  // running, type a time and the entry stops there. The dial follows too: a
  // dashed stub while the end is unset, a real arc with a draggable handle once
  // it is.
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
    // Half-typed: refuse rather than guess, the same as a bad start time. An
    // empty field is not half-typed. It means the entry has no end, so a
    // running one keeps running and a finished one keeps the end it already has.
    if (endMinutes === null && endTime.trim() !== "") return;

    if (endMinutes !== null) {
      // Offset 0 with an end at or before the start would be a zero or negative
      // entry; that reading always belongs to the next day.
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
            // A null project means the description's usual project was retired;
            // leave the current one alone rather than guessing.
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

      {/* One click for the common case. Typing an end time does the same thing at
          a minute of your choosing, which is what the field above is for. */}
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
