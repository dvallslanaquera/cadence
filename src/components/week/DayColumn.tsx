"use client";

import {
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  CREATE_SNAP_MINUTES,
  DEFAULT_BLOCK_MINUTES,
  FINE_SNAP_MINUTES,
  SNAP_MINUTES,
} from "@/lib/constants";
import { intentFromClick, pixelsToMinutes } from "@/domain/layout";
import { formatDurationHuman, formatMinutesAsClock } from "@/domain/time";
import { cn } from "@/lib/utils";
import { EntryBlock } from "./EntryBlock";
import { GRID_MINUTES, type PositionedSegment } from "./geometry";

const CLICK_THRESHOLD_PX = 5;
// Touch double-tap window/travel. Single taps are swallowed by the pointer path, so this is the only touch create path.
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_MAX_PX = 30;

export interface DayColumnProps {
  dayKey: string;
  segments: PositionedSegment[];
  isToday: boolean;
  /** False on phone, where the editor opens as a centered overlay. */
  isDesktop: boolean;
  selectedEntryId: string | null;
  onSelectEntry: (id: string | null) => void;
  onCreateRange: (dayKey: string, startMinutes: number, endMinutes: number) => void;
  /** Dblclick on empty space starts a live timer at that minute. See intentFromClick for when it means a fixed block instead. */
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
  isDesktop,
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
  // Last unpaired touch tap; nulled after a pair fires so a triple tap doesn't start a second entry.
  const lastTap = useRef<{ time: number; y: number } | null>(null);
  // Suppress the synthetic dblclick that follows a touch double-tap so create doesn't fire twice.
  const suppressDoubleClickUntil = useRef(0);

  function minutesAt(clientY: number, snapMinutes: number): number {
    const rect = columnRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return pixelsToMinutes(clientY - rect.top, pxPerMinute, snapMinutes, GRID_MINUTES);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    if (event.target !== event.currentTarget) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragState.current = {
      anchorMinutes: minutesAt(event.clientY, event.altKey ? FINE_SNAP_MINUTES : SNAP_MINUTES),
      moved: false,
    };
    setGhost(null);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragState.current;
    if (!state) return;

    const current = minutesAt(event.clientY, event.altKey ? FINE_SNAP_MINUTES : SNAP_MINUTES);
    if (!state.moved && Math.abs(current - state.anchorMinutes) * pxPerMinute < CLICK_THRESHOLD_PX) {
      return;
    }
    state.moved = true;
    setGhost({
      from: Math.min(state.anchorMinutes, current),
      to: Math.max(state.anchorMinutes, current),
    });
  }

  // Shared by mouse dblclick and touch double-tap so the two create paths don't drift apart.
  function createIntentAt(clientY: number) {
    const intent = intentFromClick(
      minutesAt(clientY, CREATE_SNAP_MINUTES),
      segments.map((segment) => ({
        startMinutes: segment.topMinutes,
        endMinutes: segment.bottomMinutes,
      })),
      { nowMinutes, defaultMinutes: DEFAULT_BLOCK_MINUTES, dayLengthMinutes: GRID_MINUTES },
    );
    if (intent?.kind === "start") onStartTimerAt(dayKey, intent.startMinutes);
    else if (intent) onCreateRange(dayKey, intent.startMinutes, intent.endMinutes);
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const state = dragState.current;
    dragState.current = null;
    const preview = ghost;
    setGhost(null);
    if (!state) return;
    event.currentTarget.releasePointerCapture(event.pointerId);

    // A single click creates nothing (stray taps while scrolling left timers running); use double-click or double-tap.
    if (!state.moved) {
      // Touch under pointer capture doesn't raise dblclick; read a second tap as the double-tap. Mouse uses the dblclick path below.
      if (event.pointerType === "touch") {
        const now = Date.now();
        const prev = lastTap.current;
        if (
          prev &&
          now - prev.time < DOUBLE_TAP_MS &&
          Math.abs(event.clientY - prev.y) < DOUBLE_TAP_MAX_PX
        ) {
          lastTap.current = null;
          suppressDoubleClickUntil.current = now + 500;
          createIntentAt(event.clientY);
        } else {
          lastTap.current = { time: now, y: event.clientY };
        }
      }
      return;
    }
    if (!preview) return;

    // A drag that collapsed to nothing still gets the one-minute minimum.
    const from = preview.from;
    const to = preview.to > preview.from ? preview.to : preview.from + 1;
    onCreateRange(dayKey, from, to);
  }

  // Dblclick starts a live timer where you clicked; on a past day or ahead of now it logs a clipped default block instead.
  function onDoubleClick(event: ReactMouseEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return;
    // Touch double-tap was handled in onPointerUp; the synthetic dblclick would double-create.
    if (Date.now() < suppressDoubleClickUntil.current) return;
    createIntentAt(event.clientY);
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
          isDesktop={isDesktop}
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
