-- A per-user UI zoom applied as CSS `zoom` on <html>: "default" | "small" | "large".
-- Defaults to "default" so existing installs keep the current size until Settings picks one.
ALTER TABLE "Settings" ADD COLUMN "fontSize" TEXT NOT NULL DEFAULT 'default';