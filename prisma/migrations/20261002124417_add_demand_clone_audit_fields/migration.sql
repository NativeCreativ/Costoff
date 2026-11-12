-- DropIndex
DROP INDEX "demand_assignments_one_active_owner_per_demand";

-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "clone_reason" TEXT,
ADD COLUMN     "cloned_at" TIMESTAMPTZ(6),
ADD COLUMN     "cloned_by" UUID,
ADD COLUMN     "old_demand_id" UUID;

-- CreateIndex
CREATE INDEX "demands_old_demand_id_idx" ON "demands"("old_demand_id");

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_cloned_by_fkey" FOREIGN KEY ("cloned_by") REFERENCES "profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_old_demand_id_fkey" FOREIGN KEY ("old_demand_id") REFERENCES "demands"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
