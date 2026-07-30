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
  /**
   * A valid "HH:MM" to fall back to when the field is left holding something
   * that is not a time. Usually the entry's own current time.
   */
  fallback: string;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}

/**
 * A time field that behaves like text.
 *
 * `input type="time"` is a segmented control: the pointer is an arrow, the value
 * is three widgets in a trench coat, and putting the caret somewhere useful takes
 * more than one click. This is an ordinary text box with an I-beam, so one click
 * puts the caret where you clicked and you type over it. The colon is inserted for
 * you and arrow keys still nudge, which is the only part of the native control
 * worth keeping.
 */
export function TimeInput({
  value,
  onChange,
  fallback,
  placeholder = "09:00",
  className,
  "aria-label": ariaLabel,
}: TimeInputProps) {
  function nudge(event: KeyboardEvent<HTMLInputElement>, direction: 1 | -1) {
    // Nudging a half-typed field starts from the fallback, so the arrows are
    // never dead. An empty field with no fallback is the end of a running entry:
    // there is no time there to step away from, so the arrows do nothing.
    const current = parseClockToMinutes(value) ?? parseClockToMinutes(fallback);
    if (current === null) return;

    event.preventDefault();
    const step = event.altKey ? FINE_SNAP_MINUTES : event.shiftKey ? 60 : SNAP_MINUTES;
    const next = (((current + direction * step) % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
      MINUTES_PER_DAY;
    onChange(formatMinutesAsClock(next));
  }

  /**
   * Pad and tidy on the way out. "9:3" goes back to the fallback rather than
   * becoming 09:30, because 9:03 was just as likely and guessing edits your data.
   *
   * Silent when there is nothing to fix, because the editor treats any change to
   * a time as an edit: reporting one for a field that was only clicked into would
   * re-derive the end's day offset and quietly take a day off a multi-day entry.
   */
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
