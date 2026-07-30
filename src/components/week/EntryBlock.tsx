"use client";

import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
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
  /**
   * Move the whole entry by a delta in minutes. Returning the mutation's promise
   * lets the block hold its dragged position until the write has landed.
   */
  onMove: (segment: PositionedSegment, deltaMinutes: number) => void | Promise<unknown>;
  /** Resize one edge. `edge` is which handle was dragged. */
  onResize: (
    segment: PositionedSegment,
    edge: "start" | "end",
    deltaMinutes: number,
  ) => void | Promise<unknown>;
  snapMinutes: number;
  pxPerMinute: number;
  readOnly?: boolean;
}

/** The drag in progress, in snapped minutes. Null between drags. */
interface DragPreview {
  mode: "move" | "start" | "end";
  minutes: number;
}

export function EntryBlock({
  segment,
  selected,
  onSelect,
  onMove,
  onResize,
  snapMinutes,
  pxPerMinute,
  readOnly,
}: EntryBlockProps) {
  const drag = useRef<{
    mode: "move" | "start" | "end";
    originY: number;
    applied: number;
  } | null>(null);

  // Rendered from local state during a drag, so the block tracks the pointer at
  // frame rate instead of jumping once the PATCH comes back.
  const [preview, setPreview] = useState<DragPreview | null>(null);

  /**
   * Whether the editor's description dropdown is showing. Radix listens for
   * Escape on the document in the capture phase, which runs before the field's
   * own handler, so the flag has to be readable from out here for the first
   * Escape to dismiss the list instead of the whole editor. A ref, not state:
   * nothing on screen depends on it.
   */
  const suggestionsOpen = useRef(false);
  const setSuggestionsOpen = useCallback((open: boolean) => {
    suggestionsOpen.current = open;
  }, []);

  const { entry, running } = segment;

  // Apply the in-flight drag to the geometry before it is drawn.
  const shift = preview?.minutes ?? 0;
  const previewTop =
    segment.topMinutes + (preview?.mode === "move" || preview?.mode === "start" ? shift : 0);
  const previewBottom =
    segment.bottomMinutes + (preview?.mode === "move" || preview?.mode === "end" ? shift : 0);

  const { top, height } = segmentToBlock(previewTop, previewBottom, pxPerMinute);
  const color = entry.project.color;

  const laneWidth = 100 / segment.laneCount;

  /**
   * Keep a drag inside the day and never let an edge cross the other one, so the
   * preview can only ever show a shape the server would accept.
   */
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
    // A running entry has no fixed end to drag.
    if (running && mode !== "start") return;
    event.stopPropagation();
    event.preventDefault();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    drag.current = { mode, originY: event.clientY, applied: 0 };
  }

  function onPointerMove(event: ReactPointerEvent<HTMLElement>) {
    const state = drag.current;
    if (!state) return;
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
      // No movement: this was a click, so open the editor.
      setPreview(null);
      onSelect(entry.id);
      return;
    }

    // Hold the dragged position until the mutation settles. Dropping it on
    // release would show one frame of the old position before the optimistic
    // cache write arrives — and on a rejected edit, this is what puts the block
    // back where it started.
    const settled =
      state.mode === "move"
        ? onMove(segment, state.applied)
        : onResize(segment, state.mode, state.applied);

    void Promise.resolve(settled)
      .catch(() => {
        // The mutation reports its own failure; this only ends the preview.
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
              // No transition while dragging: the block must sit under the
              // pointer, not ease towards it.
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

            {/* Resize handles. The bottom one is hidden on a running entry — it
                has no fixed end to drag. */}
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
          side="right"
          align="start"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(340px,calc(100vw-24px))] rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow)]"
          onOpenAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (suggestionsOpen.current) event.preventDefault();
          }}
        >
          <EntryPopover
            entry={entry}
            onClose={() => onSelect(null)}
            onSuggestionsOpenChange={setSuggestionsOpen}
          />
          <Popover.Arrow className="fill-[var(--border)]" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
