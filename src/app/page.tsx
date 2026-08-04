import { Suspense } from "react";
import { WeekView } from "@/components/week/WeekView";
import { Spinner } from "@/components/ui/primitives";
import { getLanguageSafe } from "@/server/settings";
import { metadataTitle } from "@/lib/i18n";

export async function generateMetadata() {
  return { title: metadataTitle(await getLanguageSafe(), "page.week") };
}

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