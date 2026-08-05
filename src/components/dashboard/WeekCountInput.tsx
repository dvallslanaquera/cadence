"use client";

import { Input } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n-client";

// Owns its own 1..260 clamp + floor; the chart just reads and writes whole numbers.
export function WeekCountInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const { t } = useT();

  return (
    <label className="flex items-center gap-1.5 text-xs text-fg-muted">
      {t("chart.perWeek.weeks")}
      <Input
        type="number"
        min={1}
        max={260}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isFinite(next) && next >= 1 && next <= 260) {
            onChange(Math.floor(next));
          }
        }}
        className="h-8 w-20"
      />
    </label>
  );
}