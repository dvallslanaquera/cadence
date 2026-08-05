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

// Translation hook. Reads the live language from settings so components re-render when it changes, and returns a `t`/`plural` bound to that language. Also keeps the module-level currentLang in step, so toast handlers and other non-hook code translate in the right language without their own subscription.
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

/** BCP47 locale for the live language, for date formatters. */
export function useLocale(): string {
  const { data: settings } = useSettings();
  const lang: Lang = (settings?.language as Lang) ?? "en";
  return localeFor(lang);
}

// Keeps module-level currentLang in sync with the stored setting, so non-hook code (the mutation hooks in queries.ts) translates in the right language. useT already does this for components that call it; this covers the ones that don't. Sibling of ThemeSync.
export function LanguageSync() {
  const { data: settings } = useSettings();
  const lang: Lang = (settings?.language as Lang) ?? "en";

  useEffect(() => {
    setCurrentLang(lang);
  }, [lang]);

  return null;
}