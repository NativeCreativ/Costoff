-- AlterTable
ALTER TABLE "demands" ADD COLUMN "contact_profile_id" UUID;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_contact_profile_id_fkey" FOREIGN KEY ("contact_profile_id") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
