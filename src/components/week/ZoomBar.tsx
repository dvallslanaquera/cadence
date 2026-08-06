"use client";

import { Maximize2 } from "lucide-react";
import { useT } from "@/lib/i18n-client";
import { IconButton } from "@/components/ui/primitives";

interface ZoomBarProps {
  hourHeight: number;
  onApplyZoom: (next: number) => void;
  onResetFit: () => void;
  min: number;
  max: number;
}

export function ZoomBar({ hourHeight, onApplyZoom, onResetFit, min, max }: ZoomBarProps) {
  const { t } = useT();

  return (
    <div className="mt-2 flex items-center justify-start gap-2">
      <IconButton label={t("week.fit")} onClick={onResetFit}>
        <Maximize2 className="h-3.5 w-3.5" />
      </IconButton>
      <input
        type="range"
        aria-label={t("week.zoom")}
        min={min}
        max={max}
        step={1}
        value={hourHeight}
        onChange={(event) => onApplyZoom(Number(event.target.value))}
        className="h-1 w-28 cursor-pointer accent-accent"
      />
    </div>
  );
}