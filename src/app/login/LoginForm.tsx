"use client";

import { useActionState } from "react";
import { authenticate } from "./actions";
import { t, type Lang } from "@/lib/i18n";

const field =
  "mt-1 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-fg outline-none transition focus:border-accent";
const labelClass = "block text-xs font-medium text-fg-muted";

/** English literal the server action returns on bad credentials. */
const INVALID_CREDENTIALS = "Invalid email or password.";

export function LoginForm({ lang }: { lang: Lang }) {
  const [error, formAction, pending] = useActionState(authenticate, undefined);

  // Server action returns English; map the known literal to translated, anything else shows as-is.
  const message =
    error === INVALID_CREDENTIALS ? t("login.error.invalid", undefined, lang) : error;

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label htmlFor="email" className={labelClass}>
          {t("login.email", undefined, lang)}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className={field}
        />
      </div>

      <div>
        <label htmlFor="password" className={labelClass}>
          {t("login.password", undefined, lang)}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={field}
        />
      </div>

      {message && <p className="text-sm text-red-500">{message}</p>}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition hover:opacity-90 disabled:opacity-60"
      >
        {pending ? t("login.signingIn", undefined, lang) : t("login.signin", undefined, lang)}
      </button>
    </form>
  );
}