"use client";

import { type KeyboardEvent } from "react";
import { FINE_SNAP_MINUTES, SNAP_MINUTES } from "@/lib/constants";
import { formatMinutesAsClock, maskClockInput, parseClockToMinutes } from "@/domain/time";
import { cn } from "@/lib/utils";
import { Input } from "./primitives";

const MINUTES_PER_DAY = 1440;

export interface TimeInputProps {
  /** "HH:MM", or whatever is half-typed on the way there. */
  value: string;
  onChange: (value: string) => void;
  /** Valid "HH:MM" to fall back to when the field holds something that isn't a time. */
  fallback: string;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

// A time field that behaves like text: input type=time is a segmented control with an arrow pointer, so this is a plain box with an I-beam. Colon inserted, arrow keys nudge.
export function TimeInput({
  value,
  onChange,
  fallback,
  placeholder = "09:00",
  className,
  "aria-label": ariaLabel,
}: TimeInputProps) {
  function nudge(event: KeyboardEvent<HTMLInputElement>, direction: 1 | -1) {
    // Nudge from fallback when the field is half-typed so arrows are never dead; empty with no fallback (running entry's end) means nothing to step from.
    const current = parseClockToMinutes(value) ?? parseClockToMinutes(fallback);
    if (current === null) return;

    event.preventDefault();
    const step = event.altKey ? FINE_SNAP_MINUTES : event.shiftKey ? 60 : SNAP_MINUTES;
    const next = (((current + direction * step) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
      MINUTES_PER_DAY;
    onChange(formatMinutesAsClock(next));
  }

  // Pad and tidy on blur; "9:3" falls back rather than guessing 09:30. Silent when nothing to fix, since reporting a change for a merely-clicked field would re-derive the end's day offset.
  function commit() {
    const minutes = parseClockToMinutes(value);
    const tidied = minutes === null ? fallback : formatMinutesAsClock(minutes);
    if (tidied !== value) onChange(tidied);
  }

  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      maxLength={5}
      placeholder={placeholder}
      aria-label={ariaLabel}
      value={value}
      className={cn("tabular cursor-text", className)}
      onChange={(event) => onChange(maskClockInput(event.target.value))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") nudge(event, 1);
        if (event.key === "ArrowDown") nudge(event, -1);
      }}
    />
  );
}
