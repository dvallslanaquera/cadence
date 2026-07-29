import { requiredDate, route, searchParams } from "@/server/api";
import { createEntry, listEntries } from "@/server/services/entries";
import { getTimezone } from "@/server/settings";
import { entryCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const params = searchParams(request);
  const from = requiredDate(params, "from");
  const to = requiredDate(params, "to");
  return { entries: await listEntries(from, to) };
});

export const POST = route(async (request) => {
  const input = entryCreateSchema.parse(await request.json());
  const entry = await createEntry(input, await getTimezone());
  return { entry };
});
