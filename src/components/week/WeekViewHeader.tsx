"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatDurationHuman, formatRangeLabel, isoWeekNumber } from "@/domain/time";
import { useT } from "@/lib/i18n-client";
import { Button, IconButton } from "@/components/ui/primitives";

interface WeekViewHeaderProps {
  weekStart: Date;
  weekEnd: Date;
  weekTotal: number;
  tz: string;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onToday: () => void;
}

export function WeekViewHeader({
  weekStart,
  weekEnd,
  weekTotal,
  tz,
  onPrevWeek,
  onNextWeek,
  onToday,
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

      <h1 className="tabular min-w-0 truncate text-base font-semibold text-fg">
        {t("week.tracked", { n: formatDurationHuman(weekTotal) })}
      </h1>
    </div>
  );
}