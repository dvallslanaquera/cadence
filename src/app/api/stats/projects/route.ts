import { requiredDate, route, searchParams } from "@/server/api";
import { projectStats } from "@/server/services/stats";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const params = searchParams(request);
  return {
    projects: await projectStats(requiredDate(params, "from"), requiredDate(params, "to")),
  };
});
