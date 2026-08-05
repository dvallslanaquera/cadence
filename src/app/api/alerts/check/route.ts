import { routeWithSecret } from "@/server/api";
import { runAlertCheck } from "@/server/services/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Cron target called by GitHub Actions, not a browser; auths on a shared secret since a cron request has no session. See ARCHITECTURE.md §12. */
export const POST = routeWithSecret(async () => {
  return runAlertCheck();
});
