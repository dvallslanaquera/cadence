-- The backlog's top-level split: work-related tasks and study tasks.
--
-- Coarser than a project, and deliberately a separate axis from it — a project
-- can hold tasks on both sides, and the dashboard keeps reporting per project
-- rather than collapsing to two slices.
CREATE TYPE "TaskSection" AS ENUM ('WORK', 'STUDY');

-- Existing tasks predate the split and are all work, which is also the default
-- a task takes when the form does not say otherwise.
ALTER TABLE "Task" ADD COLUMN "section" "TaskSection" NOT NULL DEFAULT 'WORK';

CREATE INDEX "Task_section_status_idx" ON "Task"("section", "status");
