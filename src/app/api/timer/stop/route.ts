import { route } from "@/server/api";
import { stopTimer } from "@/server/services/entries";

export const POST = route(async () => {
  return { entry: await stopTimer() };
});
