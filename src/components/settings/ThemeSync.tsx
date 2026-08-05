"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/queries";

// Client-side sync of data-theme; layout.tsx sets it before first paint. System clears the attribute so the OS media query takes over.
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