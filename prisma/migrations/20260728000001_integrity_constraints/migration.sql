-- Constraints Prisma cannot express. See ARCHITECTURE.md §4.

-- 1. At most one running entry, ever.
CREATE UNIQUE INDEX "one_running_entry"
  ON "TimeEntry" (("endedAt" IS NULL))
  WHERE "endedAt" IS NULL;

-- 2. No two closed entries may overlap. Half-open ranges: [start, end).
--    Application code checks first so the user gets a readable message; this is
--    what makes the rule actually true under concurrent writes.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "TimeEntry" ADD CONSTRAINT "no_overlapping_entries"
  EXCLUDE USING gist (tstzrange("startedAt", "endedAt", '[)') WITH &&)
  WHERE ("endedAt" IS NOT NULL);

-- 3. An entry never ends before it starts.
ALTER TABLE "TimeEntry" ADD CONSTRAINT "end_after_start"
  CHECK ("endedAt" IS NULL OR "endedAt" > "startedAt");

-- 4. Settings is a single row.
ALTER TABLE "Settings" ADD CONSTRAINT "settings_singleton" CHECK (id = 1);

-- 5. The system project ("Others") cannot be deleted.
--
-- A trigger, not a RULE. A conditional `DO INSTEAD NOTHING` rule makes Postgres
-- reject `DELETE ... RETURNING` on the whole table ("cannot perform DELETE
-- RETURNING on relation") — and that is exactly what Prisma emits, so a rule
-- here breaks deletion of *every* project, not just the protected one.
--
-- Raising is also better than silently doing nothing: the service layer already
-- returns a 400 for this case, so reaching the trigger means something bypassed
-- it and deserves to fail loudly.
CREATE OR REPLACE FUNCTION "protect_system_project"() RETURNS trigger AS $$
BEGIN
  IF OLD."isSystem" THEN
    RAISE EXCEPTION 'The system project cannot be deleted'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "protect_system_project"
  BEFORE DELETE ON "Project"
  FOR EACH ROW EXECUTE FUNCTION "protect_system_project"();
