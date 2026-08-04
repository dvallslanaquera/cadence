"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { Button } from "./primitives";
import { useT } from "@/lib/i18n-client";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A focused yes/no prompt. Escape and clicking the backdrop both cancel, since
 * either is a "I changed my mind" gesture and the action is destructive enough
 * (completing a task, deleting something) that backing out is the safe default.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { t } = useT();
  const confirm = confirmLabel ?? t("confirm.confirm");
  const cancel = cancelLabel ?? t("confirm.cancel");
  return (
    <Dialog.Root open={open} onOpenChange={(next) => {
      if (!next) onCancel();
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[70] bg-black/40" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[80] w-[min(420px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-surface p-4 shadow-[var(--shadow)] focus:outline-none"
        >
          <Dialog.Title className="text-sm font-semibold">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description className="mt-1.5 text-sm text-fg-muted">
              {description}
            </Dialog.Description>
          ) : null}
          <div className="mt-4 flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={onCancel}>
              {cancel}
            </Button>
            <Button size="sm" variant="primary" onClick={onConfirm}>
              {confirm}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}