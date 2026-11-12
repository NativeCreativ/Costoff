-- Candidate Step 2: DB-level uniqueness on normalized email/phone.
-- Functional indexes so uniqueness holds regardless of raw column formatting
-- (case/whitespace for email, punctuation/spacing for phone). NULLs are
-- excluded by Postgres automatically, so candidates without an email/phone
-- are unaffected.
CREATE UNIQUE INDEX "candidates_normalized_email_key" ON "candidates" (LOWER(TRIM("email"))) WHERE "email" IS NOT NULL;
CREATE UNIQUE INDEX "candidates_normalized_phone_key" ON "candidates" (regexp_replace("phone", '\D', '', 'g')) WHERE "phone" IS NOT NULL;
