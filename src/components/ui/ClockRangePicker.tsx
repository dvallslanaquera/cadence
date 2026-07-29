"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { FINE_SNAP_MINUTES, SNAP_MINUTES } from "@/lib/constants";
import { formatDurationHuman, formatMinutesAsClock } from "@/domain/time";
import { cn, withAlpha } from "@/lib/utils";

/**
 * A 24-hour dial for editing a time range by dragging, the way Toggl's clock
 * does. One revolution is one day, so a handle position names a time of day
 * outright — no AM/PM to disambiguate, and the arc between the handles *is* the
 * duration. That matches the week grid, which is also a 24-hour scale.
 *
 * The dial only ever expresses times of day. Which calendar day the end lands on
 * is the caller's problem: an end at or before the start wraps past midnight.
 */

const MINUTES_PER_DAY = 1440;

// viewBox units. Rendered at whatever CSS size the parent gives it.
const SIZE = 176;
const CENTER = SIZE / 2;
const TRACK_RADIUS = 64;
const HANDLE_RADIUS = 9;
const TICK_INNER = 54;

/** 00:00 at the top, clockwise — the direction a clock and the grid both run. */
function polar(minutes: number, radius: number): { x: number; y: number } {
  const radians = ((minutes / MINUTES_PER_DAY) * 360 - 90) * (Math.PI / 180);
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

/** Forward span from `from` to `to`, wrapping past midnight. */
function forwardSpan(from: number, to: number): number {
  return ((to - from) % MINUTES_PER_DAY + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function arcPath(from: number, to: number, radius: number): string {
  const a = polar(from, radius);
  const b = polar(to, radius);
  const largeArc = forwardSpan(from, to) > MINUTES_PER_DAY / 2 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${largeArc} 1 ${b.x} ${b.y}`;
}

const wrap = (minutes: number) =>
  ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

export type ClockHandle = "start" | "end";

export interface ClockRangePickerProps {
  startMinutes: number;
  /** Null for a running entry: there is no end to place yet. */
  endMinutes: number | null;
  onChange: (handle: ClockHandle, minutes: number) => void;
  /** Total span in minutes, which the caller knows and the dial cannot (>24h). */
  spanMinutes?: number;
  color?: string;
  className?: string;
}

export function ClockRangePicker({
  startMinutes,
  endMinutes,
  onChange,
  spanMinutes,
  color = "var(--accent)",
  className,
}: ClockRangePickerProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<ClockHandle | null>(null);
  const [active, setActive] = useState<ClockHandle | null>(null);

  const running = endMinutes === null;
  const span = spanMinutes ?? forwardSpan(startMinutes, endMinutes ?? startMinutes);

  /** Pointer position -> time of day, snapped. Alt gives minute precision. */
  function minutesAt(event: ReactPointerEvent<SVGElement>): number {
    const svg = svgRef.current;
    if (!svg) return startMinutes;
    const rect = svg.getBoundingClientRect();
    const degrees =
      (Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) *
        180) /
      Math.PI;
    const raw = ((degrees + 90) / 360) * MINUTES_PER_DAY;
    const snap = event.altKey ? FINE_SNAP_MINUTES : SNAP_MINUTES;
    return wrap(Math.round(wrap(raw) / snap) * snap);
  }

  function beginDrag(event: ReactPointerEvent<SVGElement>, handle: ClockHandle) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = handle;
    setActive(handle);
  }

  function onPointerMove(event: ReactPointerEvent<SVGElement>) {
    const handle = dragging.current;
    if (!handle) return;
    const next = minutesAt(event);
    const current = handle === "start" ? startMinutes : endMinutes;
    if (next !== current) onChange(handle, next);
  }

  function endDrag(event: ReactPointerEvent<SVGElement>) {
    if (!dragging.current) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    dragging.current = null;
    setActive(null);
  }

  /** Arrow keys nudge; shift jumps by the hour. Dials are not only for mice. */
  function onKeyDown(event: KeyboardEvent<SVGElement>, handle: ClockHandle) {
    const step = event.shiftKey ? 60 : SNAP_MINUTES;
    const delta =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? step
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -step
          : 0;
    if (delta === 0) return;
    event.preventDefault();
    const current = handle === "start" ? startMinutes : (endMinutes ?? startMinutes);
    onChange(handle, wrap(current + delta));
  }

  const start = polar(startMinutes, TRACK_RADIUS);
  const end = polar(endMinutes ?? startMinutes, TRACK_RADIUS);
  const fullDay = !running && span > 0 && span % MINUTES_PER_DAY === 0;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-44 w-44 touch-none select-none overflow-visible"
        role="group"
        aria-label="Time range dial"
      >
        {/* Track */}
        <circle
          cx={CENTER}
          cy={CENTER}
          r={TRACK_RADIUS}
          fill="none"
          stroke="var(--grid-line-strong)"
          strokeWidth={8}
        />

        {/* Hour ticks; the quarter marks are longer and carry the labels. */}
        {Array.from({ length: 24 }, (_, hour) => {
          const major = hour % 6 === 0;
          const outer = polar(hour * 60, TICK_INNER);
          const inner = polar(hour * 60, major ? TICK_INNER - 7 : TICK_INNER - 4);
          return (
            <line
              key={hour}
              x1={outer.x}
              y1={outer.y}
              x2={inner.x}
              y2={inner.y}
              stroke={major ? "var(--fg-subtle)" : "var(--border-strong)"}
              strokeWidth={major ? 1.5 : 1}
              strokeLinecap="round"
            />
          );
        })}
        {[0, 6, 12, 18].map((hour) => {
          const at = polar(hour * 60, TICK_INNER - 18);
          return (
            <text
              key={hour}
              x={at.x}
              y={at.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="tabular fill-[var(--fg-subtle)] text-[9px]"
            >
              {hour}
            </text>
          );
        })}

        {/* The selected range. A running entry has no end, so it gets a stub. */}
        {fullDay ? (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={TRACK_RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={8}
          />
        ) : (
          <path
            d={arcPath(startMinutes, running ? startMinutes + 1 : (endMinutes as number), TRACK_RADIUS)}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={running ? "3 6" : undefined}
          />
        )}

        {/* Centre readout: what the arc currently means, in words. */}
        <text
          x={CENTER}
          y={CENTER - 9}
          textAnchor="middle"
          dominantBaseline="central"
          className="tabular fill-[var(--fg)] text-[15px] font-semibold"
        >
          {running ? "running" : formatDurationHuman(span)}
        </text>
        <text
          x={CENTER}
          y={CENTER + 10}
          textAnchor="middle"
          dominantBaseline="central"
          className="tabular fill-[var(--fg-subtle)] text-[10px]"
        >
          {formatMinutesAsClock(startMinutes)}
          {running ? "" : ` – ${formatMinutesAsClock(endMinutes as number)}`}
        </text>

        {/* Handles. Start is hollow, end is solid — the same read as the grid's
            top and bottom resize edges. */}
        <circle
          cx={start.x}
          cy={start.y}
          r={HANDLE_RADIUS}
          fill="var(--surface)"
          stroke={color}
          strokeWidth={3.5}
          tabIndex={0}
          role="slider"
          aria-label="Start time"
          aria-valuemin={0}
          aria-valuemax={MINUTES_PER_DAY - 1}
          aria-valuenow={startMinutes}
          aria-valuetext={formatMinutesAsClock(startMinutes)}
          className={cn(
            "cursor-grab outline-none",
            active === "start" && "cursor-grabbing",
          )}
          style={{ filter: active === "start" ? `drop-shadow(0 0 6px ${withAlpha("#000000", 0.25)})` : undefined }}
          onPointerDown={(event) => beginDrag(event, "start")}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={(event) => onKeyDown(event, "start")}
        />
        {running ? null : (
          <circle
            cx={end.x}
            cy={end.y}
            r={HANDLE_RADIUS}
            fill={color}
            stroke="var(--surface)"
            strokeWidth={2.5}
            tabIndex={0}
            role="slider"
            aria-label="End time"
            aria-valuemin={0}
            aria-valuemax={MINUTES_PER_DAY - 1}
            aria-valuenow={endMinutes as number}
            aria-valuetext={formatMinutesAsClock(endMinutes as number)}
            className={cn("cursor-grab outline-none", active === "end" && "cursor-grabbing")}
            onPointerDown={(event) => beginDrag(event, "end")}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(event) => onKeyDown(event, "end")}
          />
        )}
      </svg>

      <p className="mt-0.5 text-[10px] text-fg-subtle">
        Drag the handles · hold Alt for 1-minute steps
      </p>
    </div>
  );
}
