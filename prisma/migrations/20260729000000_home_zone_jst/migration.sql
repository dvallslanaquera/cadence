-- The home zone every date in the app is rendered in.
--
-- This is a single-user app with exactly one Settings row, so moving the
-- default without moving that row would leave the grid and the now-line still
-- drawing in the old zone. Only a row still sitting on the previous default is
-- touched; a zone chosen deliberately in Settings is left alone.
ALTER TABLE "Settings" ALTER COLUMN "timezone" SET DEFAULT 'Asia/Tokyo';

UPDATE "Settings" SET "timezone" = 'Asia/Tokyo' WHERE "timezone" = 'Europe/Madrid';
