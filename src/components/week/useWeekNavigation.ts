"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { shiftWeeks, weekKey as toWeekKey } from "@/domain/time";

/**
 * Week navigation lives in the URL so reloads and shared links land on the same
 * week. See ARCHITECTURE.md §8. Navigation only; the caller owns any UI state
 * (e.g. the mobile day index) that should follow a change.
 */
export function useWeekNavigation(weekStart: Date, tz: string) {
  const router = useRouter();

  const goToWeek = useCallback(
    (delta: number) => {
      router.push(`/?week=${toWeekKey(shiftWeeks(weekStart, tz, delta), tz)}`, { scroll: false });
    },
    [router, weekStart, tz],
  );

  const goToToday = useCallback(() => {
    router.push(`/?week=${toWeekKey(new Date(), tz)}`, { scroll: false });
  }, [router, tz]);

  return { goToWeek, goToToday };
}