-- Add Company SPOC (companies.spoc_id) and per-company experience levels (companies.experience_levels).
--
-- Both are optional and nullable/defaulted, so every existing company keeps loading and saving:
-- spoc_id stays NULL and experience_levels stays an empty array (no back-fill, no rewrite).
ALTER TABLE "companies" ADD COLUMN "spoc_id" UUID;
ALTER TABLE "companies" ADD COLUMN "experience_levels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE INDEX "companies_spoc_id_idx" ON "companies" ("spoc_id");

ALTER TABLE "companies"
  ADD CONSTRAINT "companies_spoc_id_fkey"
  FOREIGN KEY ("spoc_id") REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;