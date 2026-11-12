-- Migration: fix pipeline entry sources
--
-- Rule: every pipeline entry (submissions) gets its source from the candidate it links to,
-- instead of the hardcoded "internal_db" default. Existing "internal_db" and empty/null
-- values are replaced by the candidate's own source. "indeed" entries (if any) stay as-is.
--
-- Backup table created first for rollback.

-- Drop existing check constraint that only allows old values
ALTER TABLE "submissions" DROP CONSTRAINT IF EXISTS "submissions_source_check";

CREATE TABLE submissions_source_backup AS
SELECT id, source FROM submissions;

-- Update submissions with "internal_db" or empty/null source to use candidate's source
UPDATE submissions s
SET source = COALESCE(c.source, '')
FROM candidates c
WHERE s.candidate_id = c.id
  AND (s.source = 'internal_db' OR s.source IS NULL OR s.source = '');

-- Recreate check constraint with new allowed values (matches unified source list)
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_source_check"
CHECK (source IN ('naukri','linkedin','indeed','direct','referral','others',''));

-- Index for faster source filtering
CREATE INDEX IF NOT EXISTS submissions_source_idx ON submissions(source);