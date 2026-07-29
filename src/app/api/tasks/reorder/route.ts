import { z } from "zod";
import { route } from "@/server/api";
import { reorderTasks } from "@/server/services/tasks";

const schema = z.object({ orderedIds: z.array(z.string().min(1)).max(500) });

export const POST = route(async (request) => {
  const { orderedIds } = schema.parse(await request.json());
  await reorderTasks(orderedIds);
  return { ok: true };
});
