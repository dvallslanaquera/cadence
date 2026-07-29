import { Suspense } from "react";
import { WeekView } from "@/components/week/WeekView";
import { Spinner } from "@/components/ui/primitives";

export const metadata = { title: "Week · Cadence" };

export default function WeekPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      }
    >
      <WeekView />
    </Suspense>
  );
}
