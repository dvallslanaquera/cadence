import { route } from "@/server/api";
import { frequentProjectIds } from "@/server/services/projects";
import { FREQUENT_PROJECT_COUNT, FREQUENT_PROJECT_WINDOW_DAYS } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Ids only, most-used first; the picker already holds names and colours, so sending them again would be a second source of truth. */
export const GET = route(async () => ({
  projectIds: await frequentProjectIds(FREQUENT_PROJECT_WINDOW_DAYS, FREQUENT_PROJECT_COUNT),
}));
