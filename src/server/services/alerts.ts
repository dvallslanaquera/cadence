/** Runaway-timer check; the partial unique index guarantees at most one running entry, so findFirst is enough. See ARCHITECTURE.md §12. */
import { Resend } from "resend";
import { db } from "@/server/db";
import { getSettings } from "@/server/settings";
import { elapsedHours, shouldAlert } from "@/domain/alerts";
import { formatClock, formatDateISO, formatDurationHuman } from "@/domain/time";
import { t, isLang, type Lang } from "@/lib/i18n";

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

  // Stamp the heartbeat whatever happens — a check that found nothing is still proof the scheduler is alive.
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
    lang: isLang(settings.language) ? settings.language : "en",
  });

  // Only stamp after the send succeeds, so a transient email failure retries on the next run instead of silently swallowing the alert.
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
  lang: Lang;
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
  const { lang } = entry;

  const lines = [
    t("email.line1", { elapsed }, lang),
    "",
    `  ${t("email.desc", undefined, lang).padEnd(11)}: ${label}`,
    `  ${t("email.project", undefined, lang).padEnd(11)}: ${entry.projectName}`,
    ...(entry.taskName ? [`  ${t("email.task", undefined, lang).padEnd(11)}: ${entry.taskName}`] : []),
    `  ${t("email.started", undefined, lang).padEnd(11)}: ${formatDateISO(entry.startedAt, entry.timezone)} ${t("email.at", undefined, lang)} ${formatClock(
      entry.startedAt,
      entry.timezone,
    )} (${entry.timezone})`,
    `  ${t("email.elapsed", undefined, lang).padEnd(11)}: ${formatDurationHuman(
      Math.round((entry.now.getTime() - entry.startedAt.getTime()) / 60_000),
    )}`,
    "",
    t("email.nochange", undefined, lang),
    ...(appUrl ? ["", appUrl] : []),
  ];

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to,
    subject: t("email.subject", { elapsed, label }, lang),
    text: lines.join("\n"),
  });

  if (error) {
    throw new Error(`Resend rejected the alert email: ${error.message}`);
  }
}
