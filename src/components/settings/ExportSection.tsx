"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import {
  formatDateISO,
  instantFromLocalParts,
  shiftWeeks,
  startOfLocalWeek,
} from "@/domain/time";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n-client";

/** Range picker defaulting to the current week. See ARCHITECTURE.md §11. */
export function ExportSection({ tz }: { tz: string }) {
  const [from, setFrom] = useState(() => formatDateISO(startOfLocalWeek(new Date(), tz), tz));
  // The stored end is exclusive; show the inclusive Sunday.
  const [to, setTo] = useState(() => {
    const nextWeek = shiftWeeks(startOfLocalWeek(new Date(), tz), tz, 1);
    return formatDateISO(new Date(nextWeek.getTime() - 1), tz);
  });
  const { t } = useT();

  function download() {
    const fromInstant = instantFromLocalParts(from, 0, tz);
    // Exclusive end: midnight at the start of the day after `to`.
    const toInstant = new Date(instantFromLocalParts(to, 0, tz).getTime() + 24 * 3_600_000);
    const url = `/api/export.csv?from=${encodeURIComponent(
      fromInstant.toISOString(),
    )}&to=${encodeURIComponent(toInstant.toISOString())}`;
    window.location.href = url;
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-1 text-sm font-semibold">{t("export.title")}</h2>
      <p className="mb-3 text-xs text-fg-muted">{t("export.hint")}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("export.from")}>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label={t("export.to")}>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>

      <Button variant="primary" className="mt-3" onClick={download}>
        <Download className="h-4 w-4" />
        {t("export.download")}
      </Button>
    </section>
  );
}
