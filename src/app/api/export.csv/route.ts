import { requiredDate, route, searchParams } from "@/server/api";
import { csvFilename, streamEntriesCsv } from "@/server/services/export";
import { getTimezone } from "@/server/settings";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const params = searchParams(request);
  const from = requiredDate(params, "from");
  const to = requiredDate(params, "to");
  const tz = await getTimezone();

  return new Response(streamEntriesCsv(from, to, tz), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${csvFilename(from, to, tz)}"`,
      "Cache-Control": "no-store",
    },
  });
});
