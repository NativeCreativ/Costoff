-- Rule: a demand remembers which skills-library category was picked in its Required Skills.
-- Nullable and no backfill: an older demand has no category, and guessing one from its
-- technology_stack would be wrong (that list is hand-edited and can be emptied).
-- ON DELETE SET NULL: the library hard-deletes a category with no in-use block, so a deleted
-- category must degrade to "no category" instead of blocking the delete.
ALTER TABLE "demands" ADD COLUMN "skills_category_id" UUID;

CREATE INDEX "demands_skills_category_id_idx" ON "demands"("skills_category_id");

ALTER TABLE "demands" ADD CONSTRAINT "demands_skills_category_id_fkey"
  FOREIGN KEY ("skills_category_id") REFERENCES "skill_categories"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;