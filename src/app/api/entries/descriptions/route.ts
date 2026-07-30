import { route } from "@/server/api";
import { descriptionHistory } from "@/server/services/entries";
import { DESCRIPTION_HISTORY_LIMIT } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * The descriptions the entry editor completes against, most-used first. Sent
 * whole and matched in the browser, so the dropdown keeps up with typing.
 */
export const GET = route(async () => ({
  descriptions: await descriptionHistory(DESCRIPTION_HISTORY_LIMIT),
}));
