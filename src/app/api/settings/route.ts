import { ApiError, route } from "@/server/api";
import { db } from "@/server/db";
import { getSettings, isValidTimezone, toSettingsDto } from "@/server/settings";
import { settingsUpdateSchema } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const GET = route(async () => {
  return { settings: toSettingsDto(await getSettings()) };
});

export const PATCH = route(async (request) => {
  const input = settingsUpdateSchema.parse(await request.json());

  if (input.timezone && !isValidTimezone(input.timezone)) {
    throw new ApiError(400, `"${input.timezone}" is not a time zone this browser knows`);
  }

  await getSettings(); // ensure the row exists
  const settings = await db.settings.update({ where: { id: 1 }, data: input });
  return { settings: toSettingsDto(settings) };
});
