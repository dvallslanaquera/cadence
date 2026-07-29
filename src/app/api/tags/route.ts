import { route } from "@/server/api";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Tags are created inline when typing in the entry popover, not managed here. */
export const GET = route(async () => {
  const tags = await db.tag.findMany({ orderBy: { name: "asc" }, select: { name: true } });
  return { tags: tags.map((tag) => tag.name) };
});
