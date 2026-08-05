import type { Settings } from "@prisma/client";
import { db } from "@/server/db";
import { isLang, type Lang } from "@/lib/i18n";

export interface SettingsDto {
  timezone: string;
  dailyGoalHours: number;
  weeklyChartWeeks: number;
  alertAfterHours: number;
  theme: string;
  language: string;
  alertsEnabled: boolean;
  lastAlertCheckAt: string | null;
}

/** Upsert so a fresh database self-heals without the seed; the check constraint keeps it to one row. */
export async function getSettings(): Promise<Settings> {
  return db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export async function getTimezone(): Promise<string> {
  return (await getSettings()).timezone;
}

/** Read-only theme lookup for the per-request root layout; falls back to System when no Settings row exists yet. */
export async function getTheme(): Promise<string> {
  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { theme: true } });
  return settings?.theme ?? "system";
}

/** Read-only language lookup; the root layout sets <html lang> from it so the first frame is localised. Defaults to English. */
export async function getLanguage(): Promise<string> {
  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { language: true } });
  return settings?.language ?? "en";
}

/** getLanguage as a validated Lang, defaulting to English so a bad or missing row never breaks page metadata. */
export async function getLanguageSafe(): Promise<Lang> {
  try {
    const lang = await getLanguage();
    return isLang(lang) ? lang : "en";
  } catch {
    return "en";
  }
}

export function toSettingsDto(settings: Settings): SettingsDto {
  return {
    timezone: settings.timezone,
    dailyGoalHours: settings.dailyGoalHours,
    weeklyChartWeeks: settings.weeklyChartWeeks,
    alertAfterHours: settings.alertAfterHours,
    theme: settings.theme,
    language: settings.language,
    alertsEnabled: settings.alertsEnabled,
    lastAlertCheckAt: settings.lastAlertCheckAt
      ? settings.lastAlertCheckAt.toISOString()
      : null,
  };
}

/** Reject a zone Intl doesn't know, before it poisons every rendered date. */
export function isValidTimezone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
