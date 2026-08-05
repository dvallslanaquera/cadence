"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_BLOCK_MINUTES, MAX_HOUR_HEIGHT_PX, MIN_HOUR_HEIGHT_PX } from "@/lib/constants";
import { useMediaQuery, useNow } from "@/lib/hooks";
import {
  useCreateEntry,
  useEntries,
  useSettings,
  useStartTimer,
  useTasks,
  useUpdateEntry,
} from "@/lib/queries";
import {
  dayKey as toDayKey,
  instantFromLocalParts,
  isWeekKey,
  shiftInstant,
  shiftWeeks,
  startOfLocalWeek,
  weekDays,
  weekStartFromKey,
} from "@/domain/time";
import { newEntryId } from "@/lib/utils";
import { useT } from "@/lib/i18n-client";
import type { Task } from "@/lib/types";
import { DayHeaderRow } from "./DayHeaderRow";
import { MobileDayStrip } from "./MobileDayStrip";
import { WeekGrid } from "./WeekGrid";
import { WeekViewHeader } from "./WeekViewHeader";
import { ZoomBar } from "./ZoomBar";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { useWeekNavigation } from "./useWeekNavigation";
import { useZoom } from "./useZoom";
import { dayTotalMinutes, segmentsByDay, type PositionedSegment } from "./geometry";

const GUTTER_PX = 52;

export function WeekView() {
  const searchParams = useSearchParams();
  const { data: settings } = useSettings();
  const tz = settings?.timezone ?? "UTC";
  const { t } = useT();

  const now = useNow(30_000);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [mobileDayIndex, setMobileDayIndex] = useState<number | null>(null);

  const { hourHeight, pxPerMinute, applyZoom, resetFit } = useZoom(scrollRef);

  // Week lives in the URL so reloads and shared links land on the same week. See ARCHITECTURE.md §8.
  const weekParam = searchParams.get("week");
  const weekStart = useMemo(() => {
    if (weekParam && isWeekKey(weekParam)) return weekStartFromKey(weekParam, tz);
    return startOfLocalWeek(new Date(), tz);
  }, [weekParam, tz]);

  const days = useMemo(() => weekDays(weekStart, tz), [weekStart, tz]);
  const weekEnd = useMemo(() => shiftWeeks(weekStart, tz, 1), [weekStart, tz]);

  const { goToWeek, goToToday } = useWeekNavigation(weekStart, tz);

  const { data: entries, isLoading: entriesLoading } = useEntries(weekStart, weekEnd);
  const { data: tasks } = useTasks({
    dueFrom: toDayKey(days[0], tz),
    dueTo: toDayKey(days[6], tz),
  });

  const startTimer = useStartTimer();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();

  const segments = useMemo(
    () => segmentsByDay(entries ?? [], tz, now),
    [entries, tz, now],
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks ?? []) {
      if (!task.dueDate) continue;
      const list = map.get(task.dueDate) ?? [];
      list.push(task);
      map.set(task.dueDate, list);
    }
    return map;
  }, [tasks]);

  const todayKey = toDayKey(now, tz);

  // Pick the day tab on first load; follow a "today" jump but leave the user's manual pick alone otherwise.
  useEffect(() => {
    if (mobileDayIndex !== null) return;
    const index = days.findIndex((day) => toDayKey(day, tz) === todayKey);
    setMobileDayIndex(index >= 0 ? index : 0);
  }, [days, tz, todayKey, mobileDayIndex]);

  // Today jump also snaps the mobile tab to today, so the strip and the URL agree.
  const handleToday = useCallback(() => {
    goToToday();
    const index = weekDays(new Date(), tz).findIndex(
      (day) => toDayKey(day, tz) === toDayKey(new Date(), tz),
    );
    if (index >= 0) setMobileDayIndex(index);
  }, [goToToday, tz]);

  const shortcuts = useMemo(
    () => ({
      ArrowLeft: () => goToWeek(-1),
      ArrowRight: () => goToWeek(1),
      t: handleToday,
      T: handleToday,
      Escape: () => setSelectedEntryId(null),
    }),
    [goToWeek, handleToday],
  );
  useKeyboardShortcuts(shortcuts);

  // Create paths open the editor before the POST returns; the id is minted here so the optimistic block and server row share it. See ARCHITECTURE.md §8.
  const dropSelection = useCallback((id: string) => {
    setSelectedEntryId((current) => (current === id ? null : current));
  }, []);

  const startTimerMutate = startTimer.mutate;
  const createEntryMutate = createEntry.mutate;
  const updateEntryAsync = updateEntry.mutateAsync;

  const quickStart = useCallback(
    (task?: Task) => {
      const id = newEntryId();
      setSelectedEntryId(id);
      startTimerMutate(
        task
          ? { id, description: task.name, projectId: task.project.id, taskId: task.id }
          : { id },
        { onError: () => dropSelection(id) },
      );
    },
    [startTimerMutate, dropSelection],
  );

  const startTimerAt = useCallback(
    (dayKeyValue: string, startMinutes: number) => {
      const id = newEntryId();
      setSelectedEntryId(id);
      startTimerMutate(
        { id, startedAt: instantFromLocalParts(dayKeyValue, startMinutes, tz).toISOString() },
        { onError: () => dropSelection(id) },
      );
    },
    [startTimerMutate, dropSelection, tz],
  );

  const createRange = useCallback(
    (dayKeyValue: string, startMinutes: number, endMinutes: number) => {
      const id = newEntryId();
      setSelectedEntryId(id);
      createEntryMutate(
        {
          id,
          startedAt: instantFromLocalParts(dayKeyValue, startMinutes, tz).toISOString(),
          endedAt: instantFromLocalParts(dayKeyValue, endMinutes, tz).toISOString(),
        },
        { onError: () => dropSelection(id) },
      );
    },
    [createEntryMutate, dropSelection, tz],
  );

  // Return the mutation promise so the block holds its drag until the write settles. Stable identities avoid re-rendering sibling blocks.
  const moveEntry = useCallback(
    (segment: PositionedSegment, deltaMinutes: number) => {
      const entry = segment.entry;
      if (!entry.endedAt) return;
      const shift = deltaMinutes * 60_000;
      return updateEntryAsync({
        id: entry.id,
        startedAt: shiftInstant(entry.startedAt, shift),
        endedAt: shiftInstant(entry.endedAt, shift),
      });
    },
    [updateEntryAsync],
  );

  const resizeEntry = useCallback(
    (segment: PositionedSegment, edge: "start" | "end", deltaMinutes: number) => {
      const entry = segment.entry;
      const shift = deltaMinutes * 60_000;
      if (edge === "start") {
        return updateEntryAsync({ id: entry.id, startedAt: shiftInstant(entry.startedAt, shift) });
      }
      if (!entry.endedAt) return;
      return updateEntryAsync({ id: entry.id, endedAt: shiftInstant(entry.endedAt, shift) });
    },
    [updateEntryAsync],
  );

  const visibleDays = isDesktop ? days : days.slice(mobileDayIndex ?? 0, (mobileDayIndex ?? 0) + 1);
  const weekTotal = days.reduce(
    (sum, day) => sum + dayTotalMinutes(segments.get(toDayKey(day, tz))),
    0,
  );

  const gridTemplate = `${GUTTER_PX}px repeat(${visibleDays.length}, minmax(0, 1fr))`;

  return (
    <div className="flex flex-1 min-h-0 flex-col py-3">
      <WeekViewHeader
        weekStart={weekStart}
        weekEnd={weekEnd}
        weekTotal={weekTotal}
        tz={tz}
        onPrevWeek={() => goToWeek(-1)}
        onNextWeek={() => goToWeek(1)}
        onToday={handleToday}
        onQuickStart={() => quickStart()}
      />

      {!isDesktop ? (
        <MobileDayStrip
          days={days}
          tz={tz}
          segments={segments}
          mobileDayIndex={mobileDayIndex}
          onSelectDay={setMobileDayIndex}
        />
      ) : null}

      <DayHeaderRow
        visibleDays={visibleDays}
        tz={tz}
        segments={segments}
        tasksByDay={tasksByDay}
        todayKey={todayKey}
        gridTemplate={gridTemplate}
        onQuickStart={quickStart}
      />

      <WeekGrid
        visibleDays={visibleDays}
        tz={tz}
        segments={segments}
        selectedEntryId={selectedEntryId}
        todayKey={todayKey}
        hourHeight={hourHeight}
        pxPerMinute={pxPerMinute}
        now={now}
        isDesktop={isDesktop}
        entriesLoading={entriesLoading}
        scrollRef={scrollRef}
        gridTemplate={gridTemplate}
        onSelectEntry={setSelectedEntryId}
        onCreateRange={createRange}
        onStartTimerAt={startTimerAt}
        onMoveEntry={moveEntry}
        onResizeEntry={resizeEntry}
      />

      <ZoomBar
        hourHeight={hourHeight}
        onApplyZoom={applyZoom}
        onResetFit={resetFit}
        min={MIN_HOUR_HEIGHT_PX}
        max={MAX_HOUR_HEIGHT_PX}
      />

      <p className="mt-2 text-center text-[11px] text-fg-subtle">
        {t("week.hint", { block: DEFAULT_BLOCK_MINUTES })}
      </p>
    </div>
  );
}