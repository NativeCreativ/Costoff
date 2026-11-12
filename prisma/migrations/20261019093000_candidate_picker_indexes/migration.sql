-- Indexes for the "Add Existing Candidate" picker (GET /api/candidates?picker=all).
--
-- Rule: the picker must stay fast on a candidate pool of thousands to lakhs. Its WHERE clause
-- is `%term% ILIKE` over name/email/phone/skills, which a btree cannot serve, plus a keyset
-- ORDER BY created_at DESC, id DESC. So: pg_trgm + GIN for the substring search, and one
-- composite btree for the ordering so each page is an index scan, not a sort.
--
-- Without these the picker degrades to a sequential scan per keystroke — this is the migration
-- that makes the search safe at scale.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX candidates_full_name_trgm_idx ON "candidates" USING gin ("full_name" gin_trgm_ops);
CREATE INDEX candidates_email_trgm_idx ON "candidates" USING gin ("email" gin_trgm_ops);
CREATE INDEX candidates_phone_trgm_idx ON "candidates" USING gin ("phone" gin_trgm_ops);

-- PostgreSQL refuses to index array_to_string(skills, ',') directly because it is only STABLE.
-- This wrapper is the standard fix: the picker query must call the SAME function or the index
-- is never used (see src/lib/candidates/candidatePickerQuery.ts).
CREATE OR REPLACE FUNCTION candidates_skills_text(skills text[])
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$ SELECT coalesce(array_to_string(skills, ','), '') $$;

CREATE INDEX candidates_skills_trgm_idx ON "candidates" USING gin (candidates_skills_text("skills") gin_trgm_ops);

-- Keyset pagination sort order.
CREATE INDEX candidates_created_at_id_idx ON "candidates" ("created_at" DESC, "id" DESC);

-- Reversible: DROP the indexes and the function, then DROP EXTENSION pg_trgm if nothing else
-- uses it.