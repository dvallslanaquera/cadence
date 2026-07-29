import { route, searchParams } from "@/server/api";
import { createProject, listProjects } from "@/server/services/projects";
import { projectCreateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  const includeArchived = searchParams(request).get("archived") === "true";
  return { projects: await listProjects(includeArchived) };
});

export const POST = route(async (request) => {
  const input = projectCreateSchema.parse(await request.json());
  return { project: await createProject(input) };
});
