-- DropForeignKey
ALTER TABLE "companies" DROP CONSTRAINT "companies_created_by_fkey";

-- DropForeignKey
ALTER TABLE "companies" DROP CONSTRAINT "companies_updated_by_fkey";

-- DropIndex
DROP INDEX "demand_assignments_one_active_owner_per_demand";

-- DropIndex
DROP INDEX "notifications_dedupe_key_key";

-- DropIndex
DROP INDEX "notifications_entity_idx";

-- DropIndex
DROP INDEX "notifications_user_id_created_at_idx";

-- DropIndex
DROP INDEX "notifications_user_id_idx";

-- DropIndex
DROP INDEX "notifications_user_id_is_read_idx";

-- AlterTable
ALTER TABLE "companies" ALTER COLUMN "created_at" DROP NOT NULL,
ALTER COLUMN "updated_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "company_interview_rounds" ALTER COLUMN "created_at" DROP NOT NULL;

-- AlterTable
ALTER TABLE "demands" ADD COLUMN     "compensation_max_text" VARCHAR(50),
ADD COLUMN     "compensation_min_text" VARCHAR(50);

-- AlterTable
ALTER TABLE "interview_rounds" ALTER COLUMN "created_at" DROP NOT NULL,
ALTER COLUMN "updated_at" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "company_interview_rounds_round_id_idx" ON "company_interview_rounds"("round_id");

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
