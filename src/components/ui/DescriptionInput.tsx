"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { DESCRIPTION_SUGGESTION_COUNT } from "@/lib/constants";
import { rankSuggestions } from "@/domain/suggest";
import { useDescriptionHistory } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Input } from "./primitives";

export interface DescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  /** Fired when a description is chosen from the list (not typed), carrying the project it's most often logged under so the editor can switch to it. */
  onSelectSuggestion?: (description: string, projectId: string | null) => void;
  /** Enter on the field with no suggestion highlighted. */
  onSubmit: () => void;
  /** Escape with the list already closed. */
  onCancel: () => void;
  /** Reports list visibility; Radix listens for Escape on the document in capture phase, so this component can't stop the popover closing first. Keep the callback stable. */
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

// Description field with history suggestions. List opens on typing, not focus, so editing an existing entry shows the entry, not a menu covering the fields below.
export function DescriptionInput({
  value,
  onChange,
  onSelectSuggestion,
  onSubmit,
  onCancel,
  onOpenChange,
  placeholder,
  autoFocus,
}: DescriptionInputProps) {
  const { data: history } = useDescriptionHistory();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  const [typing, setTyping] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  // History arrives ordered by frequency, so ranking only filters and breaks ties; the paired project rides along so a chosen description carries its project up to the editor.
  const descriptions = useMemo(() => (history ?? []).map((item) => item.description), [history]);
  const suggestions = useMemo(
    () => rankSuggestions(descriptions, value, DESCRIPTION_SUGGESTION_COUNT),
    [descriptions, value],
  );

  const projectByDescription = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const item of history ?? []) map.set(item.description, item.projectId);
    return map;
  }, [history]);

  const open = typing && suggestions.length > 0;

  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  function close() {
    setTyping(false);
    setHighlight(-1);
  }

  function choose(suggestion: string) {
    onChange(suggestion);
    onSelectSuggestion?.(suggestion, projectByDescription.get(suggestion) ?? null);
    close();
    inputRef.current?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      // The popover's own Escape handling is suppressed while the list is up, so the first press lands here and only closes the list.
      if (open) close();
      else onCancel();
      return;
    }

    if (event.key === "Enter") {
      if (open && highlight >= 0) {
        event.preventDefault();
        choose(suggestions[highlight]);
        return;
      }
      onSubmit();
      return;
    }

    if (!open) return;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      // Past either end wraps back to the typed text, the only way to recover half-finished words without deleting a choice.
      const next = highlight + step;
      setHighlight(next < -1 ? suggestions.length - 1 : next >= suggestions.length ? -1 : next);
      return;
    }

    if (event.key === "Tab" && highlight >= 0) {
      event.preventDefault();
      choose(suggestions[highlight]);
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Input
        ref={inputRef}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={highlight >= 0 ? `${listId}-${highlight}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        onChange={(event) => {
          onChange(event.target.value);
          setTyping(true);
          setHighlight(-1);
        }}
        onKeyDown={onKeyDown}
        onBlur={close}
      />

      {open ? (
        <div
          id={listId}
          role="listbox"
          className="scroll-thin absolute left-0 right-0 top-full z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-[var(--shadow)]"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              id={`${listId}-${index}`}
              type="button"
              role="option"
              aria-selected={index === highlight}
              // Keep the caret in the field: a focus change here would fire the input's blur and close the list before the click landed.
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setHighlight(index)}
              onClick={() => choose(suggestion)}
              className={cn(
                "block w-full truncate rounded-md px-2 py-1.5 text-left text-sm transition",
                index === highlight ? "bg-accent-soft text-accent" : "text-fg hover:bg-surface-2",
              )}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
