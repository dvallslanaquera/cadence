import { route } from "@/server/api";
import { startTimer } from "@/server/services/entries";
import { timerStartSchema } from "@/lib/schemas";

export const POST = route(async (request) => {
  const input = timerStartSchema.parse(await request.json().catch(() => ({})));
  return { entry: await startTimer(input) };
});
