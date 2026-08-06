// Fallback hour height before the grid measures the viewport.
export const HOUR_HEIGHT_PX = 50;
export const PX_PER_MINUTE = HOUR_HEIGHT_PX / 60;

export const DEFAULT_SCROLL_HOUR = 9;

/** Hours the grid fits before scrolling. 9 opens on 09:00-18:00; the rest is a scroll or a zoom-out away. */
export const VISIBLE_HOURS = 9;

// Below 34px/h a 15-min block is under 9px and unclickable; above 96px/h zoom buys nothing.
export const MIN_HOUR_HEIGHT_PX = 34;
export const MAX_HOUR_HEIGHT_PX = 96;

export function fitHourHeight(viewportPx: number): number {
  const exact = viewportPx / VISIBLE_HOURS;
  return Math.min(MAX_HOUR_HEIGHT_PX, Math.max(MIN_HOUR_HEIGHT_PX, exact));
}

/** Drags snap to 5 min; hold Alt for 1-min precision. */
export const SNAP_MINUTES = 5;
export const FINE_SNAP_MINUTES = 1;

// Click-to-create snaps to 15 min: a click picks a slot, not a minute. Drags keep the finer snap.
export const CREATE_SNAP_MINUTES = 15;

// Length for a click that can't mean "now": an earlier day, or ahead of the now-line. On today a click starts a live timer instead. See intentFromClick.
export const DEFAULT_BLOCK_MINUTES = 30;

// Picker opens on most-used projects by entry count over a trailing window, so the shortlist follows current work, not all-time.
export const FREQUENT_PROJECT_COUNT = 5;
export const FREQUENT_PROJECT_WINDOW_DAYS = 30;

// History is fetched whole and matched in the browser; the limit keeps the payload small on a tracker with years of entries.
export const DESCRIPTION_HISTORY_LIMIT = 300;
export const DESCRIPTION_SUGGESTION_COUNT = 6;

/** Poll interval for the running timer; also refetches on focus. */
export const RUNNING_POLL_MS = 30_000;

// First eight are a validated categorical set the auto-assignment cycles through; the rest fill hue gaps for manual picking. First eight pass CVD and normal-vision floors on this app's surfaces (worst adjacent CVD ΔE 9.1 light / 8.4 dark). The extra twelve and any native-input colour have no tuned dark step, so darkVariant returns them unchanged. A stored colour is always the LIGHT hex; never render the first eight's light hex on dark.
export const PROJECT_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
  "#0d9488", // teal
  "#0ea5e9", // sky
  "#6366f1", // indigo
  "#c026d3", // fuchsia
  "#db2777", // pink
  "#84cc16", // lime
  "#15803d", // forest
  "#a16207", // bronze
  "#92400e", // brown
  "#475569", // slate
  "#a8a29e", // stone
  "#18181b", // ink
] as const;

const DARK_STEPS: Record<string, string> = {
  "#2a78d6": "#3987e5",
  "#eb6834": "#d95926",
  "#1baf7a": "#199e70",
  "#eda100": "#c98500",
  "#e87ba4": "#d55181",
  "#008300": "#008300",
  "#4a3aa7": "#9085e9",
  "#e34948": "#e66767",
};

/** The seeded "Others" project, and the folded slice in the donut. */
export const NEUTRAL_COLOR = "#94a3b8";

export function darkVariant(hex: string): string {
  return DARK_STEPS[hex.toLowerCase()] ?? hex;
}

export function seriesColor(hex: string, isDark: boolean): string {
  return isDark ? darkVariant(hex) : hex;
}

export function nextProjectColor(usedColors: string[]): string {
  const unused = PROJECT_COLORS.find((color) => !usedColors.includes(color));
  return unused ?? PROJECT_COLORS[usedColors.length % PROJECT_COLORS.length];
}

// id is stored on Settings and written to data-theme on <html>; globals.css turns it into a palette. `system` sets no attribute so the OS preference drives the light/dark fallback. `swatches` preview the three CSS colors (bg, surface, accent), kept in sync by hand.
export const THEME_IDS = [
  "system",
  "daylight",
  "paper",
  "midnight",
  "slate",
  "terminal",
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export type ThemeGroup = "system" | "light" | "dark";

export interface ThemeOption {
  id: ThemeId;
  label: string;
  group: ThemeGroup;
  swatches: { bg: string; surface: string; accent: string };
}

export const THEMES: ThemeOption[] = [
  {
    id: "system",
    label: "System",
    group: "system",
    swatches: { bg: "#f8fafc", surface: "#ffffff", accent: "#4f46e5" },
  },
  {
    id: "daylight",
    label: "Daylight",
    group: "light",
    swatches: { bg: "#f8fafc", surface: "#ffffff", accent: "#4f46e5" },
  },
  {
    id: "paper",
    label: "Paper",
    group: "light",
    swatches: { bg: "#faf6ef", surface: "#fffdf8", accent: "#9a3412" },
  },
  {
    id: "midnight",
    label: "Midnight",
    group: "dark",
    swatches: { bg: "#0b1120", surface: "#111827", accent: "#818cf8" },
  },
  {
    id: "slate",
    label: "Slate",
    group: "dark",
    swatches: { bg: "#0f172a", surface: "#1e293b", accent: "#38bdf8" },
  },
  {
    id: "terminal",
    label: "Terminal",
    group: "dark",
    swatches: { bg: "#050805", surface: "#0a0f0a", accent: "#4ade80" },
  },
];

// id is stored on Settings and written to data-fontsize on <html>; globals.css maps it to a `zoom` on the root. `default` sets no attribute so the page renders at 1x.
export const FONT_SIZE_IDS = ["default", "small", "large"] as const;
