-- A per-user UI language for full interface translation. Defaults to "en" so
-- existing installs stay English until the user opens Settings and picks one.
ALTER TABLE "Settings" ADD COLUMN "language" TEXT NOT NULL DEFAULT 'en';
