"use client";

import { useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { PROJECT_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

/**
 * A project's colour dot as a button. Clicking opens a menu with a native
 * colour input for any hex on top and the twenty preset swatches below it. The
 * click is stopped from bubbling so it never also selects the project, since
 * the swatch shares the row with the project's choose control.
 *
 * `size="sm"` matches the smaller dots in the settings project rows.
 */
export function ColorSwatchPicker({
  color,
  onPick,
  size = "md",
}: {
  color: string;
  onPick: (color: string) => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);

  function pick(value: string) {
    onPick(value);
    setOpen(false);
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Change project colour"
          title="Change colour"
          onClick={(event) => event.stopPropagation()}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full transition hover:bg-surface-2",
            size === "sm" ? "h-5 w-5" : "h-6 w-6",
          )}
        >
          <span
            className={cn("rounded-full", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")}
            style={{ background: color }}
          />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={4}
          collisionPadding={12}
          className="z-[70] w-[min(232px,calc(100vw-24px))] rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow)]"
        >
          <label className="flex items-center gap-2 rounded-md px-0.5 py-0.5">
            <input
              type="color"
              value={color}
              onChange={(event) => pick(event.target.value)}
              aria-label="Custom colour"
              className="h-7 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-surface p-0.5"
            />
            <span className="text-xs text-fg-muted">Custom colour</span>
          </label>

          <div className="my-2 border-t border-border" />

          <div className="grid grid-cols-5 gap-1.5">
            {PROJECT_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Use ${swatch}`}
                onClick={() => pick(swatch)}
                className={cn(
                  "h-7 w-7 rounded-full transition hover:scale-110",
                  swatch.toLowerCase() === color.toLowerCase()
                    ? "ring-2 ring-accent ring-offset-2 ring-offset-surface"
                    : "ring-1 ring-border",
                )}
                style={{ background: swatch }}
              />
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}