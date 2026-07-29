import { route } from "@/server/api";
import { deleteEntry, updateEntry } from "@/server/services/entries";
import { getTimezone } from "@/server/settings";
import { entryUpdateSchema } from "@/lib/schemas";

type Context = { params: Promise<{ id: string }> };

export const PATCH = route<Context>(async (request, { params }) => {
  const { id } = await params;
  const input = entryUpdateSchema.parse(await request.json());
  const entry = await updateEntry(id, input, await getTimezone());
  return { entry };
});

export const DELETE = route<Context>(async (_request, { params }) => {
  const { id } = await params;
  await deleteEntry(id);
  return { ok: true };
});
