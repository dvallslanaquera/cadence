"use client";

import { useMediaQuery } from "@/lib/hooks";
import { seriesColor } from "@/lib/constants";

// Recharts needs concrete values, not CSS vars; dark steps are hand-picked, not an auto flip of light.
export interface ChartTheme {
  isDark: boolean;
  surface: string;
  grid: string;
  axis: string;
  mutedInk: string;
  secondaryInk: string;
  primaryInk: string;
  /** Slot 1 — the single-series colour for bars. */
  primary: string;
  /** Slot 2 — the second series (the rolling average line). */
  secondary: string;
  reference: string;
  series: (hex: string) => string;
}

export function useChartTheme(): ChartTheme {
  const isDark = useMediaQuery("(prefers-color-scheme: dark)");

  return {
    isDark,
    surface: isDark ? "#111827" : "#ffffff",
    grid: isDark ? "#2c2c2a" : "#e1e0d9",
    axis: isDark ? "#383835" : "#c3c2b7",
    mutedInk: "#898781",
    secondaryInk: isDark ? "#c3c2b7" : "#52514e",
    primaryInk: isDark ? "#ffffff" : "#0b0b0b",
    primary: seriesColor("#2a78d6", isDark),
    secondary: seriesColor("#eb6834", isDark),
    reference: isDark ? "#c3c2b7" : "#52514e",
    series: (hex: string) => seriesColor(hex, isDark),
  };
}

/** Shared axis styling so the three panels read as one instrument. */
export const axisTick = (theme: ChartTheme) => ({
  fill: theme.mutedInk,
  fontSize: 11,
});
