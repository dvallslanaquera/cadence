import { route } from "@/server/api";
import { deleteTask, updateTask } from "@/server/services/tasks";
import { taskUpdateSchema } from "@/lib/schemas";

type Context = { params: Promise<{ id: string }> };

export const PATCH = route<Context>(async (request, { params }) => {
  const { id } = await params;
  const input = taskUpdateSchema.parse(await request.json());
  return { task: await updateTask(id, input) };
});

export const DELETE = route<Context>(async (_request, { params }) => {
  const { id } = await params;
  await deleteTask(id);
  return { ok: true };
});
