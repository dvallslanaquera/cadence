"use client";

import { useState, type ChangeEvent, type KeyboardEvent } from "react";

/**
 * A text field that captures its value on focus and commits on blur. The draft is
 * held in local state so a 30s running-entry poll never overwrites mid-typing. Enter
 * blurs to commit; Escape drops the draft and blurs. Pass the fallback (the server
 * value) and an onCommit that no-ops when the draft is null or unchanged.
 */
export function useCommitField(
  fallback: string,
  onCommit: (draft: string | null) => void,
) {
  const [draft, setDraft] = useState<string | null>(null);

  return {
    value: draft ?? fallback,
    onFocus: () => setDraft(fallback),
    onChange: (event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value),
    onBlur: () => {
      const next = draft;
      setDraft(null);
      onCommit(next);
    },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter") event.currentTarget.blur();
      if (event.key === "Escape") {
        setDraft(null);
        event.currentTarget.blur();
      }
    },
  };
}