"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Download } from "lucide-react";
import { formatDateISO, instantFromLocalParts } from "@/domain/time";
import { Button, Field, Input } from "@/components/ui/primitives";
import { useT } from "@/lib/i18n-client";

/** Range picker defaulting to the visible week. See ARCHITECTURE.md §11. */
export function ExportButton({
  weekStart,
  weekEnd,
  tz,
}: {
  weekStart: Date;
  weekEnd: Date;
  tz: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(() => formatDateISO(weekStart, tz));
  // The stored end is exclusive; show the inclusive Sunday.
  const [to, setTo] = useState(() => formatDateISO(new Date(weekEnd.getTime() - 1), tz));
  const { t } = useT();

  function download() {
    const fromInstant = instantFromLocalParts(from, 0, tz);
    // Exclusive end: midnight at the start of the day after `to`.
    const toInstant = new Date(instantFromLocalParts(to, 0, tz).getTime() + 24 * 3_600_000);
    const url = `/api/export.csv?from=${encodeURIComponent(
      fromInstant.toISOString(),
    )}&to=${encodeURIComponent(toInstant.toISOString())}`;
    window.location.href = url;
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button size="sm" variant="secondary">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("export.button")}</span>
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={12}
          className="z-50 w-[min(300px,calc(100vw-24px))] rounded-xl border border-border bg-surface p-3 shadow-[var(--shadow)]"
        >
          <p className="mb-2 text-xs text-fg-muted">{t("export.hint")}</p>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t("export.from")}>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label={t("export.to")}>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
          <Button variant="primary" className="mt-3 w-full" onClick={download}>
            <Download className="h-3.5 w-3.5" />
            {t("export.download")}
          </Button>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
