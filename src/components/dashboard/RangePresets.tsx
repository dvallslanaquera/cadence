"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n-client";

export type RangePreset = "week" | "month" | "quarter" | "year";

export const RANGE_PRESETS: RangePreset[] = ["week", "month", "quarter", "year"];

export function RangePresets({
  value,
  onChange,
}: {
  value: RangePreset;
  onChange: (preset: RangePreset) => void;
}) {
  const { t } = useT();

  return (
    <div className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-surface p-0.5">
      {RANGE_PRESETS.map((preset) => (
        <button
          key={preset}
          type="button"
          onClick={() => onChange(preset)}
          className={
            value === preset
              ? "rounded-md bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent"
              : "rounded-md px-2.5 py-1 text-xs text-fg-muted hover:text-fg"
          }
        >
          {t(`dash.range.${preset}`)}
        </button>
      ))}
    </div>
  );
}