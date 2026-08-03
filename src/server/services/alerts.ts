/**
 * The runaway-timer check. See ARCHITECTURE.md §12.
 *
 * At most one entry can be running (partial unique index), so "any task over
 * 12h" is always zero or one row — findFirst is enough.
 */
import { Resend } from "resend";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { elapsedHours, shouldAlert } from "@/domain/alerts";
import { formatClock, formatDateISO, formatDurationHuman } from "@/domain/time";

export interface AlertCheckResult {
  sent: boolean;
  entryId?: string;
  reason?: string;
}

export async function runAlertCheck(): Promise<AlertCheckResult> {
  const settings = await getSettings();
  const now = new Date();

  const running = await db.timeEntry.findFirst({
    where: { endedAt: null, alertSentAt: null },
    include: { project: { select: { name: true } }, task: { select: { name: true } } },
  });

  // Stamp the heartbeat whatever happens — a check that found nothing is still
  // proof the scheduler is alive.
  await db.settings.update({ where: { id: 1 }, data: { lastAlertCheckAt: now } });

  if (!settings.alertsEnabled) return { sent: false, reason: "alerts disabled" };
  if (!running) return { sent: false, reason: "no unalerted running entry" };
  if (!shouldAlert(running, now, settings.alertAfterHours)) {
    return { sent: false, reason: "under threshold" };
  }

  await sendRunawayTimerEmail({
    description: running.description,
    projectName: running.project.name,
    taskName: running.task?.name ?? null,
    startedAt: running.startedAt,
    now,
    timezone: settings.timezone,
    thresholdHours: settings.alertAfterHours,
  });

  // Only stamp after the send succeeds, so a transient email failure retries
  // on the next run instead of silently swallowing the alert.
  await db.timeEntry.update({
    where: { id: running.id },
    data: { alertSentAt: now },
  });

  return { sent: true, entryId: running.id };
}

interface RunawayEmail {
  description: string;
  projectName: string;
  taskName: string | null;
  startedAt: Date;
  now: Date;
  timezone: string;
  thresholdHours: number;
}

async function sendRunawayTimerEmail(entry: RunawayEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ALLOWED_EMAIL;
  const from = process.env.ALERT_FROM_EMAIL ?? "Cadence <onboarding@resend.dev>";

  if (!apiKey || !to) {
    throw new Error("RESEND_API_KEY and ALLOWED_EMAIL must both be set to send alerts");
  }

  const label = entry.description.trim() || "(no description)";
  const elapsed = elapsedHours(entry.startedAt, entry.now);
  const appUrl = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "";

  const lines = [
    `A Cadence timer has been running for ${elapsed} hours.`,
    "",
    `  Description : ${label}`,
    `  Project     : ${entry.projectName}`,
    ...(entry.taskName ? [`  Task        : ${entry.taskName}`] : []),
    `  Started     : ${formatDateISO(entry.startedAt, entry.timezone)} at ${formatClock(
      entry.startedAt,
      entry.timezone,
    )} (${entry.timezone})`,
    `  Elapsed     : ${formatDurationHuman(
      Math.round((entry.now.getTime() - entry.startedAt.getTime()) / 60_000),
    )}`,
    "",
    "Nothing has been changed — the timer is still running.",
    ...(appUrl ? ["", appUrl] : []),
  ];

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: `Timer running for ${elapsed}h — ${label}`,
    text: lines.join("\n"),
  });

  if (error) {
    throw new Error(`Resend rejected the alert email: ${error.message}`);
  }
}
