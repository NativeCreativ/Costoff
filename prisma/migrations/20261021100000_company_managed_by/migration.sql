-- Delivery Head ("Super Admin") who manages the client. account_manager_id stays AM-only, so a
-- company with no AM needs a separate owner column; exactly one of the two is set at a time.
-- ALTER TABLE IF NOT EXISTS / DROP IF EXISTS keep this re-runnable against a DB where the
-- column was already applied outside the migration ledger.
ALTER TABLE "companies" ADD COLUMN IF NOT EXISTS "managed_by" UUID;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'companies_managed_by_fkey'
    ) THEN
        ALTER TABLE "companies" ADD CONSTRAINT "companies_managed_by_fkey"
            FOREIGN KEY ("managed_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
    END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "companies_managed_by_idx" ON "companies"("managed_by");