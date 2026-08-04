"use client";

import { useCallback, useEffect } from "react";
import { useSettings } from "@/lib/queries";
import {
  setCurrentLang,
  t as translate,
  plural as pluralize,
  type Lang,
  localeFor,
} from "@/lib/i18n";

/**
 * The translation hook. Reads the live language from settings so components
 * re-render when it changes, and returns a `t` (and `plural`) bound to that
 * language. Keeps the module-level `currentLang` in step too, so toast handlers
 * and other non-hook code translate in the right language without their own
 * subscription.
 */
export function useT() {
  const { data: settings } = useSettings();
  const lang: Lang = (settings?.language as Lang) ?? "en";

  useEffect(() => {
    setCurrentLang(lang);
  }, [lang]);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(key, params, lang),
    [lang],
  );
  const plural = useCallback(
    (n: number, oneKey: string, otherKey: string, params?: Record<string, string | number>) =>
      pluralize(lang, n, oneKey, otherKey, params),
    [lang],
  );
  const locale = localeFor(lang);

  return { t, plural, lang, locale };
}

/** The BCP47 locale for the live language, for date formatters. */
export function useLocale(): string {
  const { data: settings } = useSettings();
  const lang: Lang = (settings?.language as Lang) ?? "en";
  return localeFor(lang);
}

/**
 * Keeps the module-level `currentLang` in sync with the stored setting, so
 * toast handlers and other non-hook code translate in the right language.
 * `useT` already does this for components that call it; this covers the ones
 * that don't (the mutation hooks in queries.ts). Sibling of ThemeSync.
 */
export function LanguageSync() {
  const { data: settings } = useSettings();
  const lang: Lang = (settings?.language as Lang) ?? "en";

  useEffect(() => {
    setCurrentLang(lang);
  }, [lang]);

  return null;
}