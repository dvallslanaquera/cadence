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

/**
 * Upsert rather than findUnique, so a fresh database is self-healing even if
 * the seed hasn't run. The check constraint keeps it to one row.
 */
export async function getSettings(): Promise<Settings> {
  return db.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
}

export async function getTimezone(): Promise<string> {
  return (await getSettings()).timezone;
}

/**
 * Read-only theme lookup for the root layout, which runs per request. A fresh
 * database with no Settings row yet falls back to System; the row is created
 * elsewhere (seed, or the first settings API call) so this never writes.
 */
export async function getTheme(): Promise<string> {
  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { theme: true } });
  return settings?.theme ?? "system";
}

/**
 * Read-only language lookup, mirroring getTheme. The root layout sets
 * <html lang> from it so the first frame is already localised; the alert
 * email service reads it to translate the body. Defaults to English.
 */
export async function getLanguage(): Promise<string> {
  const settings = await db.settings.findUnique({ where: { id: 1 }, select: { language: true } });
  return settings?.language ?? "en";
}

/**
 * getLanguage as a validated Lang, defaulting to English on a missing row, an
 * unreachable database, or a value outside the known set. Used by the page
 * metadata generators so a bad row never breaks the title.
 */
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
