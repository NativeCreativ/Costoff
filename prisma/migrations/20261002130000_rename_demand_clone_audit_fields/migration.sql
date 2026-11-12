-- Renames old_demand_id -> cloned_from_demand_id (matching the Phase 1 Clone Demand spec's
-- exact field name) and drops clone_reason, which is no longer a distinct concept: Clone
-- Demand now reuses the Closure reason already captured by the existing Close Demand flow
-- (demandCloseSchema's closure_feedback, stored on demand_status_events), rather than
-- collecting its own separate reason at clone time.

ALTER TABLE "demands" DROP CONSTRAINT "demands_old_demand_id_fkey";
DROP INDEX "demands_old_demand_id_idx";

ALTER TABLE "demands" RENAME COLUMN "old_demand_id" TO "cloned_from_demand_id";
ALTER TABLE "demands" DROP COLUMN "clone_reason";

CREATE INDEX "demands_cloned_from_demand_id_idx" ON "demands"("cloned_from_demand_id");

ALTER TABLE "demands" ADD CONSTRAINT "demands_cloned_from_demand_id_fkey"
  FOREIGN KEY ("cloned_from_demand_id") REFERENCES "demands"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
