import { route } from "@/server/api";
import { getRunningEntry } from "@/server/services/entries";
import { getSettings } from "@/server/settings";
import { isHeartbeatStale } from "@/domain/alerts";

export const dynamic = "force-dynamic";

/** 30-second poll target; also carries the scheduler heartbeat warning. */
export const GET = route(async () => {
  const [entry, settings] = await Promise.all([getRunningEntry(), getSettings()]);
  return {
    entry,
    alertAfterHours: settings.alertAfterHours,
    schedulerStale: isHeartbeatStale(settings.lastAlertCheckAt, new Date()),
  };
});
