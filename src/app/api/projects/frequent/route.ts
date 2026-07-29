import { route } from "@/server/api";
import { frequentProjectIds } from "@/server/services/projects";
import { FREQUENT_PROJECT_COUNT, FREQUENT_PROJECT_WINDOW_DAYS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Ids only, most-used first. The picker already holds the full project list, so
 * sending names and colours again would just be a second source of truth.
 */
export const GET = route(async () => ({
  projectIds: await frequentProjectIds(FREQUENT_PROJECT_WINDOW_DAYS, FREQUENT_PROJECT_COUNT),
}));
