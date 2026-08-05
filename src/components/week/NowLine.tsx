"use client";

import { wallClockMinutes } from "@/domain/time";

// Red current-time line. Positioned by home-zone wall-clock minutes so it tracks the entries' zone, not the browser's.
export function NowLine({
  now,
  tz,
  pxPerMinute,
}: {
  now: Date;
  tz: string;
  pxPerMinute: number;
}) {
  const top = wallClockMinutes(now, tz) * pxPerMinute;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
      style={{ top }}
      aria-hidden="true"
    >
      <span className="-ml-[5px] h-2.5 w-2.5 rounded-full bg-now" />
      <span className="h-px flex-1 bg-now" />
    </div>
  );
}
