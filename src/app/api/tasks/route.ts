import type { TaskStatus } from "@prisma/client";
import { route, searchParams } from "@/server/api";
import { createTask, listTasks } from "@/server/services/tasks";
import { taskCreateSchema, taskSectionSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const params = searchParams(request);
  const status = params.get("status");
  const section = taskSectionSchema.safeParse(params.get("section"));
  return {
    tasks: await listTasks({
      status: status === "OPEN" || status === "DONE" ? (status as TaskStatus) : undefined,
      section: section.success ? section.data : undefined,
      projectId: params.get("projectId") ?? undefined,
      dueFrom: params.get("dueFrom") ?? undefined,
      dueTo: params.get("dueTo") ?? undefined,
    }),
  };
});

export const POST = route(async (request) => {
  const input = taskCreateSchema.parse(await request.json());
  return { task: await createTask(input) };
});
