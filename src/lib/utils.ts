import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

// Client-generated id so the grid can open the editor on a new entry before the POST lands, and keep naming the same row after.
export function newEntryId(): string {
  // randomUUID needs a secure context; a phone hitting the dev server over http on the LAN is not.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Blend a project colour toward transparency for entry block fills. */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}
