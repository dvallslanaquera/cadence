import { routeWithSecret } from "@/server/api";
import { runAlertCheck } from "@/server/services/alerts";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * Called by the GitHub Actions schedule, not by a browser. Authenticates on a
 * shared secret because a cron request has no session. See ARCHITECTURE.md §12.
 */
export const POST = routeWithSecret(async () => {
  return runAlertCheck();
});
