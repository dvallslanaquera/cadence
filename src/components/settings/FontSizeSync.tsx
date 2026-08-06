"use client";

import { useEffect } from "react";
import { useSettings } from "@/lib/queries";

// Client-side sync of data-fontsize; layout.tsx sets it before first paint. Default clears the attribute so the root renders at 1x.
export function FontSizeSync() {
  const { data: settings } = useSettings();

  useEffect(() => {
    const el = document.documentElement;
    if (!settings) return;
    if (settings.fontSize === "default" || !settings.fontSize) {
      delete el.dataset.fontsize;
    } else {
      el.dataset.fontsize = settings.fontSize;
    }
  }, [settings?.fontSize]);

  return null;
}