"use client";

import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { FINE_SNAP_MINUTES, SNAP_MINUTES } from "@/lib/constants";
import { formatDurationHuman, formatMinutesAs12Hour } from "@/domain/time";
import { cn, withAlpha } from "@/lib/utils";
import { useT } from "@/lib/i18n-client";

// 12-hour dial for editing a range by dragging. A handle position alone can't say AM or PM, so the centre pair picks the half-day for whichever handle you last touched. Drag stays within a half-day (crossing noon is the buttons' job); arrow keys wrap. The dial only expresses times of day; an end at or before the start wraps past midnight.

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_HALF_DAY = 720;

// viewBox units. Rendered at whatever CSS size the parent gives it.
const SIZE = 176;
const CENTER = SIZE / 2;
const TRACK_RADIUS = 60;
const HANDLE_RADIUS = 9;
const TICK_OUTER = 50;
/** Hour numbers sit outside the ring, which leaves the middle for the readout. */
const LABEL_RADIUS = 74;

/** 12:00 at the top, clockwise, the direction a clock and the grid both run. */
function polar(minutes: number, radius: number): { x: number; y: number } {
  const radians = ((minutes / MINUTES_PER_HALF_DAY) * 360 - 90) * (Math.PI / 180);
  return {
    x: CENTER + radius * Math.cos(radians),
    y: CENTER + radius * Math.sin(radians),
  };
}

function faceSpan(from: number, to: number): number {
  return (((to - from) % MINUTES_PER_HALF_DAY) + MINUTES_PER_HALF_DAY) % MINUTES_PER_HALF_DAY;
}

function daySpan(from: number, to: number): number {
  return (((to - from) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
}

function arcPath(from: number, to: number, radius: number): string {
  const a = polar(from, radius);
  const b = polar(to, radius);
  const largeArc = faceSpan(from, to) > MINUTES_PER_HALF_DAY / 2 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${largeArc} 1 ${b.x} ${b.y}`;
}

const wrapDay = (minutes: number) =>
  ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;

const wrapFace = (minutes: number) =>
  ((Math.round(minutes) % MINUTES_PER_HALF_DAY) + MINUTES_PER_HALF_DAY) % MINUTES_PER_HALF_DAY;

/** 0 for the morning half of the day, 720 for the afternoon one. */
const meridiemOf = (minutes: number) =>
  wrapDay(minutes) < MINUTES_PER_HALF_DAY ? 0 : MINUTES_PER_HALF_DAY;

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
  const [editing, setEditing] = useState<ClockHandle>("start");
  const { t } = useT();

  const running = endMinutes === null;
  const span = spanMinutes ?? daySpan(startMinutes, endMinutes ?? startMinutes);

  const editingHandle: ClockHandle = running ? "start" : editing;
  const editingMinutes = editingHandle === "start" ? startMinutes : (endMinutes as number);

  // Alt for finer snapping.
  function faceMinutesAt(event: ReactPointerEvent<SVGElement>): number {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const degrees =
      (Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) *
        180) /
      Math.PI;
    const raw = ((degrees + 90) / 360) * MINUTES_PER_HALF_DAY;
    const snap = event.altKey ? FINE_SNAP_MINUTES : SNAP_MINUTES;
    return wrapFace(Math.round(wrapFace(raw) / snap) * snap);
  }

  function beginDrag(event: ReactPointerEvent<SVGElement>, handle: ClockHandle) {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragging.current = handle;
    setActive(handle);
    setEditing(handle);
  }

  function onPointerMove(event: ReactPointerEvent<SVGElement>) {
    const handle = dragging.current;
    if (!handle) return;
    const current = handle === "start" ? startMinutes : endMinutes;
    if (current === null) return;
    // The handle keeps the half of the day it's already in; only the buttons move it across noon.
    const next = meridiemOf(current) + faceMinutesAt(event);
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
    onChange(handle, wrapDay(current + delta));
  }

  /** Moves the editing handle into the chosen half of the day. */
  function setMeridiem(target: 0 | typeof MINUTES_PER_HALF_DAY) {
    const current = editingMinutes;
    if (meridiemOf(current) === target) return;
    onChange(editingHandle, target + wrapFace(current));
  }

  const start = polar(startMinutes, TRACK_RADIUS);
  const end = polar(endMinutes ?? startMinutes, TRACK_RADIUS);
  // Anything from twelve hours up fills the face, which is all a 12-hour ring can honestly say about it.
  const fullFace = !running && span >= MINUTES_PER_HALF_DAY;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative h-44 w-44">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="h-44 w-44 touch-none select-none overflow-visible"
          role="group"
          aria-label={t("dial.aria")}
        >
          <circle
            cx={CENTER}
            cy={CENTER}
            r={TRACK_RADIUS}
            fill="none"
            stroke="var(--grid-line-strong)"
            strokeWidth={8}
          />

          {Array.from({ length: 12 }, (_, hour) => {
            const major = hour % 3 === 0;
            const outer = polar(hour * 60, TICK_OUTER);
            const inner = polar(hour * 60, major ? TICK_OUTER - 7 : TICK_OUTER - 4);
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
          {[0, 3, 6, 9].map((hour) => {
            const at = polar(hour * 60, LABEL_RADIUS);
            return (
              <text
                key={hour}
                x={at.x}
                y={at.y}
                textAnchor="middle"
                dominantBaseline="central"
                className="tabular fill-[var(--fg-subtle)] text-[10px]"
              >
                {hour === 0 ? 12 : hour}
              </text>
            );
          })}

          {fullFace ? (
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

          {/* Start is hollow, end is solid, matching the grid's top and bottom resize edges. */}
          <circle
            cx={start.x}
            cy={start.y}
            r={HANDLE_RADIUS}
            fill="var(--surface)"
            stroke={color}
            strokeWidth={3.5}
            tabIndex={0}
            role="slider"
            aria-label={t("dial.start")}
            aria-valuemin={0}
            aria-valuemax={MINUTES_PER_DAY - 1}
            aria-valuenow={startMinutes}
            aria-valuetext={formatMinutesAs12Hour(startMinutes)}
            className={cn(
              "cursor-grab outline-none",
              active === "start" && "cursor-grabbing",
            )}
            style={{ filter: active === "start" ? `drop-shadow(0 0 6px ${withAlpha("#000000", 0.25)})` : undefined }}
            onPointerDown={(event) => beginDrag(event, "start")}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onFocus={() => setEditing("start")}
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
              aria-label={t("dial.end")}
              aria-valuemin={0}
              aria-valuemax={MINUTES_PER_DAY - 1}
              aria-valuenow={endMinutes as number}
              aria-valuetext={formatMinutesAs12Hour(endMinutes as number)}
              className={cn("cursor-grab outline-none", active === "end" && "cursor-grabbing")}
              onPointerDown={(event) => beginDrag(event, "end")}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onFocus={() => setEditing("end")}
              onKeyDown={(event) => onKeyDown(event, "end")}
            />
          )}
        </svg>

        {/* Centre readout as HTML so the AM/PM pair can be real buttons. Only the buttons take the pointer; the rest stays out of the way of a handle dragged near it. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1">
          <span className="tabular text-[15px] font-semibold leading-none text-fg">
            {running ? t("entry.running") : formatDurationHuman(span)}
          </span>

          <div className="pointer-events-auto flex overflow-hidden rounded-md border border-border">
            {([0, MINUTES_PER_HALF_DAY] as const).map((half) => {
              const selected = meridiemOf(editingMinutes) === half;
              const label = half === 0 ? t("dial.am") : t("dial.pm");
              return (
                <button
                  key={half}
                  type="button"
                  aria-pressed={selected}
                  aria-label={t("dial.handleLabel", {
                    label,
                    handle: t(editingHandle === "start" ? "dial.handleStart" : "dial.handleEnd"),
                  })}
                  onClick={() => setMeridiem(half)}
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-semibold leading-none transition",
                    selected
                      ? "bg-accent text-accent-fg"
                      : "bg-surface text-fg-subtle hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>

          <span className="text-[9px] leading-none text-fg-subtle">
            {running
              ? t("dial.handleStart")
              : t(editingHandle === "start" ? "dial.handleStart" : "dial.handleEnd")}
          </span>
        </div>
      </div>

      <p className="tabular mt-1 text-[11px] font-medium text-fg-muted">
        {formatMinutesAs12Hour(startMinutes)}
        {running ? "" : ` – ${formatMinutesAs12Hour(endMinutes as number)}`}
      </p>
      <p className="mt-0.5 text-[10px] text-fg-subtle">
        {t("dial.hint", {
          handle: t(editingHandle === "start" ? "dial.handleStart" : "dial.handleEnd"),
        })}
      </p>
    </div>
  );
}
