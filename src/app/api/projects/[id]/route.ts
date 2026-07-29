import { route, searchParams } from "@/server/api";
import {
  deleteProject,
  projectDeletionImpact,
  updateProject,
} from "@/server/services/projects";
import { projectUpdateSchema } from "@/lib/schemas";

type Context = { params: Promise<{ id: string }> };

/** Powers the confirm dialog: "this will move N entries to Others". */
export const GET = route<Context>(async (_request, { params }) => {
  const { id } = await params;
  return { impact: await projectDeletionImpact(id) };
});

export const PATCH = route<Context>(async (request, { params }) => {
  const { id } = await params;
  const input = projectUpdateSchema.parse(await request.json());
  return { project: await updateProject(id, input) };
});

export const DELETE = route<Context>(async (request, { params }) => {
  const { id } = await params;
  // Deleting without confirm=true is refused, so a stray request can't reassign
  // a project's history by accident.
  if (searchParams(request).get("confirm") !== "true") {
    return Response.json(
      { error: "Deleting a project requires confirm=true" },
      { status: 400 },
    );
  }
  return { moved: await deleteProject(id) };
});
