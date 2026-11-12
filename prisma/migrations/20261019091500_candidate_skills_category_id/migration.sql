-- Rule: a candidate remembers which skills-library category was picked in Key Skills, so Edit
-- Candidate can preselect it. Same shape as demands.skills_category_id.
-- Nullable and no backfill: an older candidate has no category, and guessing one from its
-- skills would be wrong (that list is hand-edited and can be emptied).
-- ON DELETE SET NULL: the library hard-deletes a category with no in-use block.
ALTER TABLE "candidates" ADD COLUMN "skills_category_id" UUID;

CREATE INDEX "candidates_skills_category_id_idx" ON "candidates"("skills_category_id");

ALTER TABLE "candidates" ADD CONSTRAINT "candidates_skills_category_id_fkey"
  FOREIGN KEY ("skills_category_id") REFERENCES "skill_categories"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;