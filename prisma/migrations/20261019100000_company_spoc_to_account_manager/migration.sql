-- Company SPOC is replaced by an Account Manager, so the Add Demand client dropdown can be
-- scoped to the AM who owns each client.
--
-- The old company-level SPOC is dropped outright and its values are NOT converted: SPOC and AM
-- are different roles with different meaning, and copying one into the other would invent an
-- ownership relationship nobody entered. Every existing company therefore starts with no AM,
-- which is a state the UI and the API already handle (the field is optional and clearable).
--
-- A company's demand-side SPOC (demands.spoc_profile_id) is a separate column and is untouched.
--
-- Reversible: drop account_manager_id to go back (the removed SPOC values are gone for good).
ALTER TABLE "companies" DROP COLUMN "spoc_id";

ALTER TABLE "companies" ADD COLUMN "account_manager_id" UUID;

CREATE INDEX "companies_account_manager_id_idx" ON "companies"("account_manager_id");

ALTER TABLE "companies" ADD CONSTRAINT "companies_account_manager_id_fkey"
  FOREIGN KEY ("account_manager_id") REFERENCES "profiles"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;