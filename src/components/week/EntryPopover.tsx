"use client";

import { useEffect, useState } from "react";
import { Square, Trash2 } from "lucide-react";
import {
  useDeleteEntry,
  useProjects,
  useSettings,
  useStopTimer,
  useTasks,
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
import { Button, ColorDot, Field, IconButton, Input, Select } from "@/components/ui/primitives";
import { DescriptionInput } from "@/components/ui/DescriptionInput";
import { ProjectPicker } from "@/components/ui/ProjectPicker";
import { TimeInput } from "@/components/ui/TimeInput";
import { ClockRangePicker, type ClockHandle } from "@/components/ui/ClockRangePicker";
import { seriesColor } from "@/lib/constants";
import { useMediaQuery } from "@/lib/hooks";
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
  const { data: tasks } = useTasks({ status: "OPEN" });
  const update = useUpdateEntry();
  const remove = useDeleteEntry();
  const stop = useStopTimer();

  const tz = settings?.timezone ?? "UTC";
  const running = entry.endedAt === null;
  const isDark = useMediaQuery("(prefers-color-scheme: dark)");

  const [description, setDescription] = useState(entry.description);
  const [projectId, setProjectId] = useState(entry.project.id);
  const [taskId, setTaskId] = useState(entry.task?.id ?? "");
  const [tags, setTags] = useState(entry.tags.join(", "));
  // The start's calendar day anchors the entry. It has no control of its own —
  // the entry already sits on a day in the grid, and you move it by dragging it
  // there. Only the times are editable here.
  const [startDate, setStartDate] = useState(() => formatDateISO(new Date(entry.startedAt), tz));
  const [startTime, setStartTime] = useState(() => formatClock(new Date(entry.startedAt), tz));
  const [endTime, setEndTime] = useState(() =>
    entry.endedAt ? formatClock(new Date(entry.endedAt), tz) : "",
  );
  /**
   * Days from the start's day to the end's day. Seeded from the entry so an
   * existing multi-day entry survives being merely looked at; editing either
   * time re-derives it as a single wrap, which is all a 24-hour dial can mean.
   */
  const [endDayOffset, setEndDayOffset] = useState(() =>
    entry.endedAt
      ? daysBetweenDateKeys(
          formatDateISO(new Date(entry.startedAt), tz),
          formatDateISO(new Date(entry.endedAt), tz),
        )
      : 0,
  );

  // A running entry's end moves as the timer runs; keep the fields in step when
  // the underlying entry changes beneath us (e.g. another device stopped it).
  useEffect(() => {
    setDescription(entry.description);
    setProjectId(entry.project.id);
    setTaskId(entry.task?.id ?? "");
    setTags(entry.tags.join(", "));
    setStartDate(formatDateISO(new Date(entry.startedAt), tz));
    setStartTime(formatClock(new Date(entry.startedAt), tz));
    setEndTime(entry.endedAt ? formatClock(new Date(entry.endedAt), tz) : "");
    setEndDayOffset(
      entry.endedAt
        ? daysBetweenDateKeys(
            formatDateISO(new Date(entry.startedAt), tz),
            formatDateISO(new Date(entry.endedAt), tz),
          )
        : 0,
    );
  }, [entry, tz]);

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

  /** A dial drag writes back into the same two fields the inputs edit. */
  function onDialChange(handle: ClockHandle, minutes: number) {
    const clock = formatMinutesAsClock(minutes);
    if (handle === "start") {
      setStartTime(clock);
      if (parsedEnd !== null) setEndDayOffset(wrapEndOffset(minutes, parsedEnd));
    } else {
      setEndTime(clock);
      if (parsedStart !== null) setEndDayOffset(wrapEndOffset(parsedStart, minutes));
    }
  }

  function onStartTimeInput(value: string) {
    setStartTime(value);
    const minutes = parseClockToMinutes(value);
    if (minutes !== null && parsedEnd !== null) setEndDayOffset(wrapEndOffset(minutes, parsedEnd));
  }

  function onEndTimeInput(value: string) {
    setEndTime(value);
    const minutes = parseClockToMinutes(value);
    if (minutes !== null && parsedStart !== null) {
      setEndDayOffset(wrapEndOffset(parsedStart, minutes));
    }
  }

  function save() {
    const startMinutes = parseClockToMinutes(startTime);
    if (startMinutes === null) return;

    const payload: Parameters<typeof update.mutate>[0] = {
      id: entry.id,
      description: description.trim(),
      projectId,
      taskId: taskId || null,
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
  const taskOptions = (tasks ?? []).filter(
    (task) => task.project.id === projectId || task.id === taskId,
  );

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-2">
        <DescriptionInput
          autoFocus
          value={description}
          placeholder="What are you working on?"
          onChange={setDescription}
          onSubmit={save}
          onCancel={onClose}
          onOpenChange={onSuggestionsOpenChange}
        />
        <IconButton
          label="Delete entry"
          variant="danger"
          onClick={() => {
            remove.mutate(entry);
            onClose();
          }}
        >
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      {/* Project gets its own row: side by side with Task it was ~150px wide,
          which truncates every real project name to "Freelance …" and makes the
          control read as a label rather than something you can click. */}
      <div className="space-y-2">
        <Field label="Project" as="div">
          <ProjectPicker
            value={projectId}
            onChange={setProjectId}
            fallback={entry.project}
          />
        </Field>

        <Field label="Task">
          <Select value={taskId} onChange={(event) => setTaskId(event.target.value)}>
            <option value="">None</option>
            {taskOptions.map((task) => (
              <option key={task.id} value={task.id}>
                {task.name}
              </option>
            ))}
          </Select>
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
        <Field label="Start">
          <TimeInput
            value={startTime}
            fallback={formatClock(new Date(entry.startedAt), tz)}
            onChange={onStartTimeInput}
          />
        </Field>

        <Field label="End">
          <div className="relative">
            <TimeInput
              value={endTime}
              // Empty means no end: a running entry left alone keeps running.
              fallback={entry.endedAt ? formatClock(new Date(entry.endedAt), tz) : ""}
              placeholder={running ? "running" : "17:00"}
              onChange={onEndTimeInput}
            />
            {/* The dial cannot show which day the end landed on, so say it. */}
            {endDayOffset > 0 ? (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded bg-accent-soft px-1 py-0.5 text-[10px] font-medium text-accent">
                +{endDayOffset}d
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
          Stop now
        </Button>
      ) : null}

      <Field label="Tags">
        <Input
          value={tags}
          placeholder="comma, separated"
          onChange={(event) => setTags(event.target.value)}
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
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={save} disabled={update.isPending}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
