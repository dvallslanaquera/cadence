/**
 * Grid geometry. The hour height is not fixed: the week grid measures itself and
 * zooms so VISIBLE_HOURS fits without scrolling, which is what makes the working
 * day readable on a laptop and a 4K monitor alike. These are the fallback used
 * before the first measurement and the bounds the measured value is clamped to.
 */
export const HOUR_HEIGHT_PX = 72;
export const PX_PER_MINUTE = HOUR_HEIGHT_PX / 60;

/** The working day the grid opens on: 09:00–18:00 fits, the rest scrolls. */
export const DEFAULT_SCROLL_HOUR = 9;
export const VISIBLE_HOURS = 9;

/**
 * Below ~34px an hour a 15-minute block is under 9px and stops being clickable;
 * above 96px the zoom stops buying anything on a tall screen.
 */
export const MIN_HOUR_HEIGHT_PX = 34;
export const MAX_HOUR_HEIGHT_PX = 96;

/** The hour height that shows exactly VISIBLE_HOURS in `viewportPx`. */
export function fitHourHeight(viewportPx: number): number {
  const exact = viewportPx / VISIBLE_HOURS;
  return Math.min(MAX_HOUR_HEIGHT_PX, Math.max(MIN_HOUR_HEIGHT_PX, exact));
}

/** Drags snap to 5 minutes; hold Alt for 1-minute precision. */
export const SNAP_MINUTES = 5;
export const FINE_SNAP_MINUTES = 1;

/**
 * How long a click-created block is when the click cannot mean "I am doing this
 * now", which is an earlier day or a minute ahead of the now-line. On today a
 * click starts a live timer instead and there is no length to assume. See
 * `intentFromClick`.
 */
export const DEFAULT_BLOCK_MINUTES = 30;

/**
 * The project picker opens on the projects you use most, by entry count over a
 * trailing window. A window rather than all-time so the shortlist follows what
 * you are working on now instead of what you worked on last year.
 */
export const FREQUENT_PROJECT_COUNT = 5;
export const FREQUENT_PROJECT_WINDOW_DAYS = 30;

/**
 * The description autocomplete. The history is fetched whole and matched in the
 * browser, so the limit is what keeps that payload small on a tracker with years
 * of entries in it; six visible rows is about as far down as anyone reads before
 * finishing the word themselves.
 */
export const DESCRIPTION_HISTORY_LIMIT = 300;
export const DESCRIPTION_SUGGESTION_COUNT = 6;

/** The running timer refetches on focus and on this interval. */
export const RUNNING_POLL_MS = 30_000;

/**
 * Project colours: the picker offers a native colour input plus these twenty
 * presets. The first eight are a fixed, validated categorical set in a fixed
 * order — the slots auto-assignment cycles through — and the remaining twelve
 * fill hue gaps for picking by hand.
 *
 * The first eight clear the lightness band, chroma floor, CVD separation
 * (protan and deuteran) and the normal-vision floor against this app's own
 * surfaces — verified with the palette validator, not by eye:
 *
 *   light on #ffffff : worst adjacent CVD ΔE 9.1, normal-vision ΔE 19.6
 *   dark  on #111827 : worst adjacent CVD ΔE 8.4, normal-vision ΔE 19.3
 *
 * The extra twelve and any colour chosen through the native input have no
 * tuned dark step, so `darkVariant` returns them unchanged — the same way a
 * custom hex is drawn. A stored project colour is always the LIGHT hex; never
 * render the first eight's light hex on dark, those fail the dark lightness
 * band.
 */
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

/** Resolve a stored project colour for the surface it will be drawn on. */
export function seriesColor(hex: string, isDark: boolean): string {
  return isDark ? darkVariant(hex) : hex;
}

export function nextProjectColor(usedColors: string[]): string {
  const unused = PROJECT_COLORS.find((color) => !usedColors.includes(color));
  return unused ?? PROJECT_COLORS[usedColors.length % PROJECT_COLORS.length];
}

/**
 * App themes. The id is stored on the Settings row and written to
 * `data-theme` on <html>; the CSS in globals.css turns it into a palette.
 *
 * `system` sets no attribute, so the OS preference drives the light/dark
 * fallback in globals.css. The rest force a named palette. `swatches` are the
 * three colors the settings picker previews with (background, surface,
 * accent), kept in sync with the CSS by hand.
 */
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
