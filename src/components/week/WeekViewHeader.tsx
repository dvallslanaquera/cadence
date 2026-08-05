"use client";

import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import {
  formatDurationHuman,
  formatRangeLabel,
  isoWeekNumber,
  isoWeekYear,
} from "@/domain/time";
import { useT } from "@/lib/i18n-client";
import { Button, IconButton } from "@/components/ui/primitives";
import { ExportButton } from "./ExportButton";

interface WeekViewHeaderProps {
  weekStart: Date;
  weekEnd: Date;
  weekTotal: number;
  tz: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
  onQuickStart: () => void;
}

export function WeekViewHeader({
  weekStart,
  weekEnd,
  weekTotal,
  tz,
  onPrevWeek,
  onNextWeek,
  onToday,
  onQuickStart,
}: WeekViewHeaderProps) {
  const { t, locale } = useT();

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <IconButton label={t("week.prev")} onClick={onPrevWeek}>
          <ChevronLeft className="h-4 w-4" />
        </IconButton>

        <div className="w-[112px] shrink-0 text-center leading-tight">
          <div className="tabular text-sm font-semibold">
            {t("week.weekPrefix")}{isoWeekNumber(weekStart, tz)}{t("week.weekSuffix")}
          </div>
          <div className="tabular text-[10px] text-fg-subtle">
            {formatRangeLabel(weekStart, weekEnd, tz, locale)}
          </div>
        </div>

        <IconButton label={t("week.next")} onClick={onNextWeek}>
          <ChevronRight className="h-4 w-4" />
        </IconButton>
        <Button size="sm" variant="ghost" onClick={onToday}>
          {t("week.today")}
        </Button>
      </div>

      <div className="min-w-0">
        <h1 className="tabular truncate text-base font-semibold text-fg">
          {t("week.tracked", { n: formatDurationHuman(weekTotal) })}
        </h1>
        <p className="tabular text-xs text-fg-muted">{isoWeekYear(weekStart, tz)}</p>
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        <ExportButton weekStart={weekStart} weekEnd={weekEnd} tz={tz} />
        <Button size="sm" variant="primary" onClick={onQuickStart}>
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("week.startTimer")}</span>
        </Button>
      </div>
    </div>
  );
}