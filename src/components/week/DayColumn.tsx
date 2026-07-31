"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { DEFAULT_BLOCK_MINUTES, FINE_SNAP_MINUTES, SNAP_MINUTES } from "@/lib/constants";
import { intentFromClick, pixelsToMinutes } from "@/domain/layout";
import { formatDurationHuman, formatMinutesAsClock } from "@/domain/time";
import { cn } from "@/lib/utils";
import { EntryBlock } from "./EntryBlock";
import { GRID_MINUTES, type PositionedSegment } from "./geometry";

const CLICK_THRESHOLD_PX = 5;

export interface DayColumnProps {
  dayKey: string;
  segments: PositionedSegment[];
  isToday: boolean;
  selectedEntryId: string | null;
  onSelectEntry: (id: string | null) => void;
  /** A drag on empty space becomes a completed entry over exactly that range. */
  onCreateRange: (dayKey: string, startMinutes: number, endMinutes: number) => void;
  /**
   * A double click on empty space that means "I am doing this now": start a live
   * timer at that minute and leave it running. See `intentFromClick` for when a
   * double click means this rather than a fixed block.
   */
  onStartTimerAt: (dayKey: string, startMinutes: number) => void;
  /** Wall-clock minutes of the current time, or null if this column is not today. */
  nowMinutes: number | null;
  onMoveEntry: (segment: PositionedSegment, deltaMinutes: number) => void | Promise<unknown>;
  onResizeEntry: (
    segment: PositionedSegment,
    edge: "start" | "end",
    deltaMinutes: number,
  ) => void | Promise<unknown>;
  /** Vertical scale, set by the week grid's zoom-to-fit. */
  pxPerMinute: number;
  hourHeight: number;
}

export function DayColumn({
  dayKey,
  segments,
  isToday,
  selectedEntryId,
  onSelectEntry,
  onCreateRange,
  onStartTimerAt,
  nowMinutes,
  onMoveEntry,
  onResizeEntry,
  pxPerMinute,
  hourHeight,
}: DayColumnProps) {
  const columnRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ anchorMinutes: number; moved: boolean } | null>(null);
  const [ghost, setGhost] = useState<{ from: number; to: number } | null>(null);

  function minutesAt(clientY: number, altKey: boolean): number {
    const rect = columnRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return pixelsToMinutes(
      clientY - rect.top,
      pxPerMinute,
      altKey ? FINE_SNAP_MINUTES : SNAP_MINUTES,
      GRID_MINUTES,
    );
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    // Only plain left-button presses on the background start a create gesture.
    if (event.button !== 0) return;
    if (event.target !== event.currentTarget) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = { anchorMinutes: minutesAt(event.clientY, event.altKey), moved: false };
    setGhost(null);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragState.current;
    if (!state) return;

    const current = minutesAt(event.clientY, event.altKey);
    if (!state.moved && Math.abs(current - state.anchorMinutes) * pxPerMinute < CLICK_THRESHOLD_PX) {
      return;
    }
    state.moved = true;
    setGhost({
      from: Math.min(state.anchorMinutes, current),
      to: Math.max(state.anchorMinutes, current),
    });
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragState.current;
    dragState.current = null;
    const preview = ghost;
    setGhost(null);
    if (!state) return;
    event.currentTarget.releasePointerCapture(event.pointerId);

    // A single click creates nothing; see onDoubleClick. One was too easy to
    // land while scrolling or reaching for a block, and each stray one left a
    // timer running.
    if (!state.moved || !preview) return;

    // A drag that collapsed to nothing still deserves the one-minute minimum.
    const from = preview.from;
    const to = preview.to > preview.from ? preview.to : preview.from + 1;
    onCreateRange(dayKey, from, to);
  }

  /**
   * A double click starts the timer where the pointer landed, on the assumption
   * that you are about to do the thing you just clicked. On a past day, or ahead
   * of the now-line, it logs a default-length block instead, clipped to whatever
   * comes next so it can never collide.
   */
  function onDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;

    const intent = intentFromClick(
      minutesAt(event.clientY, event.altKey),
      segments.map((segment) => ({
        startMinutes: segment.topMinutes,
        endMinutes: segment.bottomMinutes,
      })),
      { nowMinutes, defaultMinutes: DEFAULT_BLOCK_MINUTES, dayLengthMinutes: GRID_MINUTES },
    );
    if (intent?.kind === "start") onStartTimerAt(dayKey, intent.startMinutes);
    else if (intent) onCreateRange(dayKey, intent.startMinutes, intent.endMinutes);
  }

  return (
    <div
      ref={columnRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
      onPointerCancel={() => {
        dragState.current = null;
        setGhost(null);
      }}
      className={cn(
        "no-select relative touch-none border-r border-border last:border-r-0",
        isToday && "bg-accent-soft/25",
      )}
      style={{
        height: GRID_MINUTES * pxPerMinute,
        backgroundImage: `repeating-linear-gradient(to bottom, var(--grid-line-strong) 0 1px, transparent 1px ${hourHeight}px), repeating-linear-gradient(to bottom, var(--grid-line) 0 1px, transparent 1px ${hourHeight / 2}px)`,
      }}
    >
      {segments.map((segment) => (
        <EntryBlock
          key={`${segment.entry.id}-${segment.dayKey}`}
          segment={segment}
          selected={selectedEntryId === segment.entry.id}
          onSelect={onSelectEntry}
          onMove={onMoveEntry}
          onResize={onResizeEntry}
          snapMinutes={SNAP_MINUTES}
          pxPerMinute={pxPerMinute}
        />
      ))}

      {ghost ? (
        <div
          className="pointer-events-none absolute inset-x-[2px] rounded-md border border-accent bg-accent/20 px-1.5 py-0.5"
          style={{
            top: ghost.from * pxPerMinute,
            height: Math.max(2, (ghost.to - ghost.from) * pxPerMinute),
          }}
        >
          <span className="tabular text-[10px] font-semibold text-accent">
            {formatMinutesAsClock(ghost.from)}–{formatMinutesAsClock(ghost.to % 1440)}
          </span>
          <span className="tabular block text-[10px] text-accent/80">
            {formatDurationHuman(ghost.to - ghost.from)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
