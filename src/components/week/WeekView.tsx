"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  DEFAULT_BLOCK_MINUTES,
  DEFAULT_SCROLL_HOUR,
  fitHourHeight,
  HOUR_HEIGHT_PX,
} from "@/lib/constants";
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
  formatDayOfMonth,
  formatDurationHuman,
  formatMinutesAsClock,
  formatRangeLabel,
  formatWeekdayShort,
  instantFromLocalParts,
  isoWeekNumber,
  isoWeekYear,
  isWeekKey,
  shiftWeeks,
  startOfLocalWeek,
  wallClockMinutes,
  weekDays,
  weekKey as toWeekKey,
  weekStartFromKey,
} from "@/domain/time";
import { cn } from "@/lib/utils";
import { Button, IconButton, Spinner } from "@/components/ui/primitives";
import type { Task } from "@/lib/types";
import { DayColumn } from "./DayColumn";
import { DayTaskStrip } from "./DayTaskStrip";
import { ExportButton } from "./ExportButton";
import { NowLine } from "./NowLine";
import {
  dayTotalMinutes,
  GRID_MINUTES,
  segmentsByDay,
  type PositionedSegment,
} from "./geometry";

const GUTTER_PX = 52;

export function WeekView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: settings } = useSettings();
  const tz = settings?.timezone ?? "UTC";

  const now = useNow(30_000);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [mobileDayIndex, setMobileDayIndex] = useState<number | null>(null);

  /**
   * The grid zooms to fit the working day rather than using a fixed hour height,
   * so 09:00–18:00 is on screen without scrolling on any viewport. Measured in a
   * layout effect so the first paint is already at the right scale.
   */
  const [hourHeight, setHourHeight] = useState(HOUR_HEIGHT_PX);
  const pxPerMinute = hourHeight / 60;
  const lastHourHeight = useRef<number | null>(null);

  /**
   * Where the grid starts, measured rather than assumed. The chrome above it —
   * timer strip, week header, day headers — has changed shape more than once;
   * a hard-coded offset here goes stale silently and costs the grid height.
   */
  const [gridTop, setGridTop] = useState<number | null>(null);

  // The visible week lives in the URL, so a reload or a shared link lands on
  // the same week. See ARCHITECTURE.md §8.
  const weekParam = searchParams.get("week");
  const weekStart = useMemo(() => {
    if (weekParam && isWeekKey(weekParam)) return weekStartFromKey(weekParam, tz);
    return startOfLocalWeek(new Date(), tz);
  }, [weekParam, tz]);

  const days = useMemo(() => weekDays(weekStart, tz), [weekStart, tz]);
  const weekEnd = useMemo(() => shiftWeeks(weekStart, tz, 1), [weekStart, tz]);

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

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    const measure = (height: number) => {
      if (height > 0) setHourHeight(fitHourHeight(height));
    };
    measure(element.clientHeight);

    const observer = new ResizeObserver((entries) => measure(entries[0].contentRect.height));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Viewport-relative, and only meaningful while the page itself is at the top —
  // which it is by design, since the grid scrolls inside itself.
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measureTop = () => setGridTop(element.getBoundingClientRect().top + window.scrollY);
    measureTop();
    window.addEventListener("resize", measureTop);
    return () => window.removeEventListener("resize", measureTop);
  }, []);

  /**
   * Open at 09:00. On a later zoom change keep whatever minute is at the top of
   * the viewport, so resizing the window does not throw the view back to 9am.
   * Paging between weeks does not run this at all — the scroll position stays.
   */
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const previous = lastHourHeight.current;
    element.scrollTop =
      previous === null
        ? DEFAULT_SCROLL_HOUR * hourHeight
        : element.scrollTop * (hourHeight / previous);
    lastHourHeight.current = hourHeight;
  }, [hourHeight]);

  // Default the mobile view to today when today is in the visible week.
  useEffect(() => {
    if (mobileDayIndex !== null) return;
    const index = days.findIndex((day) => toDayKey(day, tz) === todayKey);
    setMobileDayIndex(index >= 0 ? index : 0);
  }, [days, tz, todayKey, mobileDayIndex]);

  function goToWeek(delta: number) {
    const target = shiftWeeks(weekStart, tz, delta);
    router.push(`/?week=${toWeekKey(target, tz)}`, { scroll: false });
  }

  function goToToday() {
    router.push(`/?week=${toWeekKey(new Date(), tz)}`, { scroll: false });
    const index = weekDays(new Date(), tz).findIndex(
      (day) => toDayKey(day, tz) === toDayKey(new Date(), tz),
    );
    if (index >= 0) setMobileDayIndex(index);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      if (event.key === "ArrowLeft") goToWeek(-1);
      if (event.key === "ArrowRight") goToWeek(1);
      if (event.key === "t" || event.key === "T") goToToday();
      if (event.key === "Escape") setSelectedEntryId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, tz]);

  /** The "Start timer" button and the day task strip: a live timer from now. */
  function quickStart(task?: Task) {
    startTimer.mutate(
      task
        ? { description: task.name, projectId: task.project.id, taskId: task.id }
        : {},
      { onSuccess: (result) => setSelectedEntryId(result.entry.id) },
    );
  }

  /**
   * Click on empty grid: you are doing this now, so start a live timer at the
   * minute you clicked and leave it running. It lands in the strip at the top of
   * every page, and stays there until you stop it or type an end time.
   */
  function startTimerAt(dayKeyValue: string, startMinutes: number) {
    startTimer.mutate(
      { startedAt: instantFromLocalParts(dayKeyValue, startMinutes, tz).toISOString() },
      { onSuccess: (result) => setSelectedEntryId(result.entry.id) },
    );
  }

  /** Drag on empty grid: a completed entry over exactly that range. */
  function createRange(dayKeyValue: string, startMinutes: number, endMinutes: number) {
    createEntry.mutate(
      {
        startedAt: instantFromLocalParts(dayKeyValue, startMinutes, tz).toISOString(),
        endedAt: instantFromLocalParts(dayKeyValue, endMinutes, tz).toISOString(),
      },
      { onSuccess: (result) => setSelectedEntryId(result.entry.id) },
    );
  }

  // These return the mutation's promise so the block can hold its dragged
  // position until the write lands or rolls back.
  function moveEntry(segment: PositionedSegment, deltaMinutes: number) {
    const entry = segment.entry;
    if (!entry.endedAt) return;
    const shift = deltaMinutes * 60_000;
    return updateEntry.mutateAsync({
      id: entry.id,
      startedAt: new Date(new Date(entry.startedAt).getTime() + shift).toISOString(),
      endedAt: new Date(new Date(entry.endedAt).getTime() + shift).toISOString(),
    });
  }

  function resizeEntry(
    segment: PositionedSegment,
    edge: "start" | "end",
    deltaMinutes: number,
  ) {
    const entry = segment.entry;
    const shift = deltaMinutes * 60_000;
    if (edge === "start") {
      return updateEntry.mutateAsync({
        id: entry.id,
        startedAt: new Date(new Date(entry.startedAt).getTime() + shift).toISOString(),
      });
    }
    if (!entry.endedAt) return;
    return updateEntry.mutateAsync({
      id: entry.id,
      endedAt: new Date(new Date(entry.endedAt).getTime() + shift).toISOString(),
    });
  }

  const visibleDays = isDesktop ? days : days.slice(mobileDayIndex ?? 0, (mobileDayIndex ?? 0) + 1);
  const weekTotal = days.reduce(
    (sum, day) => sum + dayTotalMinutes(segments.get(toDayKey(day, tz))),
    0,
  );

  const gridTemplate = `${GUTTER_PX}px repeat(${visibleDays.length}, minmax(0, 1fr))`;

  return (
    <div className="py-3">
      {/* ---- Header ---- */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <IconButton label="Previous week" onClick={() => goToWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>

          {/* The week you are on sits between the arrows that change it. */}
          <div className="w-[112px] shrink-0 text-center leading-tight">
            <div className="tabular text-sm font-semibold">
              W{isoWeekNumber(weekStart, tz)}
            </div>
            <div className="tabular text-[10px] text-fg-subtle">
              {formatRangeLabel(weekStart, weekEnd, tz)}
            </div>
          </div>

          <IconButton label="Next week" onClick={() => goToWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
          <Button size="sm" variant="ghost" onClick={goToToday}>
            Today
          </Button>
        </div>

        <div className="min-w-0">
          <h1 className="tabular truncate text-base font-semibold text-fg">
            {formatDurationHuman(weekTotal)} tracked
          </h1>
          <p className="tabular text-xs text-fg-muted">{isoWeekYear(weekStart, tz)}</p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <ExportButton weekStart={weekStart} weekEnd={weekEnd} tz={tz} />
          <Button size="sm" variant="primary" onClick={() => quickStart()}>
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Start timer</span>
          </Button>
        </div>
      </div>

      {/* ---- Mobile day strip ---- */}
      {!isDesktop ? (
        <div className="mb-2 grid grid-cols-7 gap-1">
          {days.map((day, index) => {
            const key = toDayKey(day, tz);
            const minutes = dayTotalMinutes(segments.get(key));
            const active = index === mobileDayIndex;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setMobileDayIndex(index)}
                className={cn(
                  "rounded-lg border px-0.5 py-1.5 text-center transition",
                  active
                    ? "border-accent bg-accent-soft text-accent"
                    : "border-border bg-surface text-fg-muted",
                )}
              >
                <span className="block text-[10px] uppercase">
                  {formatWeekdayShort(day, tz).slice(0, 1)}
                </span>
                <span className="block text-sm font-semibold">
                  {formatDayOfMonth(day, tz)}
                </span>
                <span className="tabular block text-[9px] opacity-70">
                  {minutes > 0 ? formatDurationHuman(minutes) : "–"}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {/* ---- Day headers ---- */}
      <div
        className="sticky top-0 z-20 grid border-b border-border bg-bg/95 backdrop-blur"
        style={{ gridTemplateColumns: gridTemplate }}
      >
        <div />
        {visibleDays.map((day) => {
          const key = toDayKey(day, tz);
          const minutes = dayTotalMinutes(segments.get(key));
          const isToday = key === todayKey;
          return (
            <div key={key} className="border-l border-border px-1 py-1.5">
              <div className="flex items-baseline justify-center gap-1.5">
                <span
                  className={cn(
                    "text-xs font-medium uppercase",
                    isToday ? "text-accent" : "text-fg-muted",
                  )}
                >
                  {formatWeekdayShort(day, tz)}
                </span>
                <span
                  className={cn(
                    "text-lg font-semibold",
                    isToday &&
                      "flex h-7 w-7 items-center justify-center rounded-full bg-accent text-accent-fg",
                  )}
                >
                  {formatDayOfMonth(day, tz)}
                </span>
              </div>
              {/* Full-strength foreground, not the subtle token: this is the
                  number you actually read off the header. */}
              <div className="tabular mt-0.5 text-center text-xs font-medium text-fg">
                {minutes > 0 ? formatDurationHuman(minutes) : "—"}
              </div>

              <DayTaskStrip
                dayKey={key}
                tasks={tasksByDay.get(key) ?? []}
                onStart={(task) => quickStart(task)}
              />
            </div>
          );
        })}
      </div>

      {/* ---- Scrolling grid ---- */}
      <div
        ref={scrollRef}
        className="scroll-thin relative overflow-y-auto rounded-b-xl border-x border-b border-border bg-surface"
        style={{
          // Below the grid: the hint line, and on mobile the bottom tab bar.
          maxHeight:
            gridTop === null
              ? "calc(100vh - 260px)"
              : `calc(100vh - ${Math.round(gridTop) + (isDesktop ? 48 : 132)}px)`,
          minHeight: 360,
        }}
      >
        {entriesLoading ? (
          <div className="absolute right-3 top-3 z-30">
            <Spinner />
          </div>
        ) : null}

        <div className="grid" style={{ gridTemplateColumns: gridTemplate }}>
          {/* Hour gutter */}
          <div className="relative" style={{ height: GRID_MINUTES * pxPerMinute }}>
            {Array.from({ length: 24 }, (_, hour) => (
              <div
                key={hour}
                className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular text-fg-subtle"
                style={{ top: hour * hourHeight }}
              >
                {hour === 0 ? "" : formatMinutesAsClock(hour * 60)}
              </div>
            ))}
          </div>

          {visibleDays.map((day) => {
            const key = toDayKey(day, tz);
            const isToday = key === todayKey;
            return (
              <div key={key} className="relative">
                <DayColumn
                  dayKey={key}
                  segments={segments.get(key) ?? []}
                  isToday={isToday}
                  selectedEntryId={selectedEntryId}
                  onSelectEntry={setSelectedEntryId}
                  onCreateRange={createRange}
                  onStartTimerAt={startTimerAt}
                  nowMinutes={isToday ? wallClockMinutes(now, tz) : null}
                  onMoveEntry={moveEntry}
                  onResizeEntry={resizeEntry}
                  pxPerMinute={pxPerMinute}
                  hourHeight={hourHeight}
                />
                {isToday ? <NowLine now={now} tz={tz} pxPerMinute={pxPerMinute} /> : null}
              </div>
            );
          })}
        </div>
      </div>

      <p className="mt-2 text-center text-[11px] text-fg-subtle">
        Click to start the timer there · drag for an exact range · a click on an earlier day
        logs a {DEFAULT_BLOCK_MINUTES}-minute block · hold Alt while dragging for minute
        precision
      </p>
    </div>
  );
}
