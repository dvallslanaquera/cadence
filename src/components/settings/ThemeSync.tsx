"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/queries";

/**
 * Keeps `data-theme` on <html> in sync with the stored setting after the first
 * paint. The server sets the attribute before paint (see layout.tsx); this only
 * updates it when the setting changes client-side, so switching a theme is
 * instant and a change made in another tab lands on the next refetch. System
 * clears the attribute so the OS media query takes over again.
 */
export function ThemeSync() {
  const { data: settings } = useSettings();

  useEffect(() => {
    const el = document.documentElement;
    if (!settings) return;
    if (settings.theme === "system") {
      delete el.dataset.theme;
    } else {
      el.dataset.theme = settings.theme;
    }
  }, [settings?.theme]);

  return null;
}