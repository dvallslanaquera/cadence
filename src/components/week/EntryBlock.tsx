"use client";

import { memo, useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { ArrowDown, ArrowUp } from "lucide-react";
import { FINE_SNAP_MINUTES } from "@/lib/constants";
import { segmentToBlock } from "@/domain/layout";
import { formatDurationHuman, formatMinutesAsClock } from "@/domain/time";
import { cn, withAlpha } from "@/lib/utils";
import { GRID_MINUTES, type PositionedSegment } from "./geometry";
import { EntryPopover } from "./EntryPopover";

export interface EntryBlockProps {
  segment: PositionedSegment;
  selected: boolean;
  onSelect: (entryId: string | null) => void;
  /** Move the entry by a delta in minutes; the returned promise lets the block hold its drag until the write lands. */
  onMove: (segment: PositionedSegment, deltaMinutes: number) => void | Promise<unknown>;
  /** Resize one edge. `edge` is which handle was dragged. */
  onResize: (
    segment: PositionedSegment,
    edge: "start" | "end",
    deltaMinutes: number,
  ) => void | Promise<unknown>;
  snapMinutes: number;
  pxPerMinute: number;
  /** False on phone, where the editor opens centered rather than the side-anchored popover that sat against the screen edge. */
  isDesktop?: boolean;
  readOnly?: boolean;
}

/** The drag in progress, in snapped minutes. Null between drags. */
interface DragPreview {
  mode: "move" | "start" | "end";
  minutes: number;
}

// Memoised: a week holds dozens, and stable props mean only the changed block re-renders.
export const EntryBlock = memo(function EntryBlock({
  segment,
  selected,
  onSelect,
  onMove,
  onResize,
  snapMinutes,
  pxPerMinute,
  isDesktop = true,
  readOnly,
}: EntryBlockProps) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    mode: "move" | "start" | "end";
    originY: number;
    applied: number;
    /** False for a gesture that may only ever be a click. See `beginDrag`. */
    draggable: boolean;
  } | null>(null);

  // Local drag state so the block tracks the pointer at frame rate, not on PATCH return.
  const [preview, setPreview] = useState<DragPreview | null>(null);

  // Radix captures Escape before the field's handler; this flag lets the first Escape close the dropdown, not the editor. Ref, not state: nothing renders from it.
  const suggestionsOpen = useRef(false);
  const setSuggestionsOpen = useCallback((open: boolean) => {
    suggestionsOpen.current = open;
  }, []);

  const { entry, running } = segment;

  const shift = preview?.minutes ?? 0;
  const previewTop =
    segment.topMinutes + (preview?.mode === "move" || preview?.mode === "start" ? shift : 0);
  const previewBottom =
    segment.bottomMinutes + (preview?.mode === "move" || preview?.mode === "end" ? shift : 0);

  const { top, height } = segmentToBlock(previewTop, previewBottom, pxPerMinute);
  const color = entry.project.color;

  const laneWidth = 100 / segment.laneCount;

  // Keep drags in-day and stop edges crossing, so previews only show shapes the server accepts.
  function clampShift(mode: "move" | "start" | "end", minutes: number): number {
    const { topMinutes, bottomMinutes } = segment;
    if (mode === "move") {
      return Math.min(Math.max(minutes, -topMinutes), GRID_MINUTES - bottomMinutes);
    }
    if (mode === "start") {
      const upper = running ? GRID_MINUTES - topMinutes : bottomMinutes - topMinutes - 1;
      return Math.min(Math.max(minutes, -topMinutes), upper);
    }
    return Math.min(
      Math.max(minutes, topMinutes - bottomMinutes + 1),
      GRID_MINUTES - bottomMinutes,
    );
  }

  function beginDrag(
    event: ReactPointerEvent<HTMLElement>,
    mode: "move" | "start" | "end",
  ) {
    if (readOnly) return;
    // Running entries have no end so can't move/resize from the bottom, but the press must still register or a click never opens the editor (the only way to trash it).
    const draggable = !running || mode === "start";
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { mode, originY: event.clientY, applied: 0, draggable };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const state = drag.current;
    if (!state || !state.draggable) return;
    const snap = event.altKey ? FINE_SNAP_MINUTES : snapMinutes;
    const rawMinutes = (event.clientY - state.originY) / pxPerMinute;
    const snapped = clampShift(state.mode, Math.round(rawMinutes / snap) * snap);
    if (snapped === state.applied) return;
    state.applied = snapped;
    setPreview(snapped === 0 ? null : { mode: state.mode, minutes: snapped });
  }

  function endDrag(event: ReactPointerEvent<HTMLElement>) {
    const state = drag.current;
    drag.current = null;
    if (!state) {
      setPreview(null);
      return;
    }
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);

    if (state.applied === 0) {
      setPreview(null);
      onSelect(entry.id);
      return;
    }

    // Hold the drag until the mutation settles; dropping on release would flash the old position, and on rejection this restores it.
    const settled =
      state.mode === "move"
        ? onMove(segment, state.applied)
        : onResize(segment, state.mode, state.applied);

    void Promise.resolve(settled)
      .catch(() => {
        // Mutation reports its own failure; this only ends the preview.
      })
      .finally(() => setPreview(null));
  }

  const label = entry.description.trim() || entry.project.name;
  const showDetail = height > 34;

  const previewDuration =
    segment.durationMinutes +
    (preview?.mode === "start" ? -shift : preview?.mode === "end" ? shift : 0);
  const rangeLabel = `${formatMinutesAsClock(previewTop)}–${formatMinutesAsClock(
    previewBottom % 1440,
  )}`;

  return (
    <Popover.Root
      open={selected}
      onOpenChange={(open) => onSelect(open ? entry.id : null)}
    >
      <Popover.Anchor asChild>
        <div
          ref={anchorRef}
          className="absolute px-[2px]"
          style={{
            top,
            height,
            left: `${segment.lane * laneWidth}%`,
            width: `${laneWidth}%`,
          }}
        >
          <div
            role="button"
            tabIndex={0}
            onPointerDown={(event) => beginDrag(event, "move")}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onSelect(entry.id);
              }
            }}
            className={cn(
              "no-select group relative flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-md border-l-[3px] px-1.5 py-0.5 text-left",
              // No transition while dragging: the block must sit under the pointer, not ease toward it.
              preview ? "ring-2 ring-accent" : "transition",
              selected && !preview ? "ring-2 ring-accent" : null,
              !selected && !preview && "hover:brightness-105",
              running && !preview && "ring-1 ring-accent/40",
            )}
            style={{
              borderLeftColor: color,
              background: withAlpha(color, running ? 0.32 : 0.22),
              color: "inherit",
            }}
            title={`${label} · ${rangeLabel} · ${formatDurationHuman(previewDuration)}`}
          >
            {segment.continuesBefore ? (
              <ArrowUp className="absolute right-1 top-0.5 h-3 w-3 opacity-50" />
            ) : null}
            {segment.continuesAfter ? (
              <ArrowDown className="absolute bottom-0.5 right-1 h-3 w-3 opacity-50" />
            ) : null}

            <span className="truncate text-[11px] font-semibold leading-tight">{label}</span>
            {showDetail ? (
              <span className="tabular truncate text-[10px] leading-tight opacity-70">
                {preview ? (
                  <>
                    {rangeLabel} · {formatDurationHuman(previewDuration)}
                  </>
                ) : (
                  <>
                    {formatDurationHuman(segment.durationMinutes)}
                    {entry.task ? ` · ${entry.task.name}` : ""}
                  </>
                )}
              </span>
            ) : null}

            {/* Resize handles; bottom hidden on a running entry (no fixed end). */}
            {!readOnly && !segment.continuesBefore ? (
              <span
                onPointerDown={(event) => beginDrag(event, "start")}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="absolute inset-x-0 top-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
                style={{ background: withAlpha(color, 0.9) }}
              />
            ) : null}
            {!readOnly && !running && !segment.continuesAfter ? (
              <span
                onPointerDown={(event) => beginDrag(event, "end")}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                className="absolute inset-x-0 bottom-0 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
                style={{ background: withAlpha(color, 0.9) }}
              />
            ) : null}
          </div>
        </div>
      </Popover.Anchor>

      <Popover.Portal>
        <Popover.Content
          side={isDesktop ? "right" : "bottom"}
          align={isDesktop ? "start" : "center"}
          sideOffset={8}
          collisionPadding={12}
          className={cn(
            "z-50",
            isDesktop
              ? "w-[min(340px,calc(100vw-24px))] rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow)]"
              : // Pin to viewport on phone; !important beats Radix's inline anchor positioning that sits the panel at the screen edge.
                "!fixed !inset-0 !flex !translate-x-0 !translate-y-0 items-center justify-center bg-black/40 p-4",
          )}
          onOpenAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (suggestionsOpen.current) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            // The block is the anchor, not the trigger, so Radix counts a press on it as outside and dismisses; prevent that to avoid a dblclick teardown flash.
            if (anchorRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
          onClick={
            isDesktop
              ? undefined
              : (event) => {
                  // Backdrop is the Content itself; a press on it (not the panel) closes, like a modal.
                  if (event.target === event.currentTarget) onSelect(null);
                }
          }
        >
          {isDesktop ? (
            <>
              <EntryPopover
                entry={entry}
                onClose={() => onSelect(null)}
                onSuggestionsOpenChange={setSuggestionsOpen}
              />
              <Popover.Arrow className="fill-[var(--border)]" />
            </>
          ) : (
            <div className="w-[min(360px,calc(100vw-32px))] rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow)]">
              <EntryPopover
                entry={entry}
                onClose={() => onSelect(null)}
                onSuggestionsOpenChange={setSuggestionsOpen}
              />
            </div>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
});
