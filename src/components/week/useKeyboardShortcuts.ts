"use client";

import { useEffect } from "react";

/**
 * Keydown listener from a stable key -> handler map. Ignores keys typed into
 * inputs, selects, and textareas. Pass a memoized map so the listener only
 * re-binds when a handler actually changes, which lets the deps be exhaustive
 * instead of suppressed.
 */
export function useKeyboardShortcuts(handlers: Record<string, () => void>) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
      const handler = handlers[event.key];
      if (handler) handler();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handlers]);
}