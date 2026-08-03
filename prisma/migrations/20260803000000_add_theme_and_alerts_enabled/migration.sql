-- Manual theme selection and an alert on/off switch.
--
-- theme defaults to "system" so existing installs keep following the OS until
-- the user picks a palette; alertsEnabled defaults on so the runaway-timer
-- alert keeps firing for anyone who never opens this setting.
ALTER TABLE "Settings" ADD COLUMN "theme" TEXT NOT NULL DEFAULT 'system';
ALTER TABLE "Settings" ADD COLUMN "alertsEnabled" BOOLEAN NOT NULL DEFAULT true;