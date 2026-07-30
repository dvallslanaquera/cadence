import { route } from "@/server/api";
import { startTimer } from "@/server/services/entries";
import { getTimezone } from "@/server/settings";
import { timerStartSchema } from "@/lib/schemas";

export const POST = route(async (request) => {
  const input = timerStartSchema.parse(await request.json().catch(() => ({})));
  // The zone is only for the clock in the "already running since 09:00" message.
  return { entry: await startTimer(input, await getTimezone()) };
});
