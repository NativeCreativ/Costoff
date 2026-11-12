-- Company master + Interview Round master.
--
-- Two new normalized masters, plus a FK from demands to companies and a
-- back-link from the existing per-demand materialized rounds to the new round
-- master. Additive only: no column is dropped or renamed, and the legacy
-- demand-level company columns (client_name / company_name / company_email) are
-- left in place as a write-through mirror so every existing consumer keeps
-- working (see the note before the demands update below).
--
-- Interview rounds: `interview_rounds` is the single reusable master of round
-- *identity* (Technical / HR / Managerial / Final HR / Architecture Review …).
-- Until now a round was just a free-text name repeated independently inside
-- `demand_interview_config.rounds`, `super_admin_settings.interview_rounds_default`
-- and the hardcoded fallback in constants.ts. `demand_interview_rounds` stays
-- exactly what its own schema comment says it is — the per-demand materialized,
-- ID-bearing projection that `interviews.round_id` references — and simply gains
-- a `master_round_id` back-link so every demand round can be traced to the one
-- master record instead of being a private string.

-- ── interview_rounds (master) ───────────────────────────────────────────────
CREATE TABLE "interview_rounds" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "name" VARCHAR(100) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "interview_rounds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "interview_rounds_sort_order_check" CHECK ("sort_order" >= 0)
);

-- Round identity is a normalized name (trimmed + lowercased), matching the
-- convention already used for candidates' normalized email/phone unique indexes
-- (migration 20260923102559). Prisma can't express a functional index, so the
-- DB is the enforcement point: creating " HR " when "hr" exists is a 409, not a
-- duplicate master row.
CREATE UNIQUE INDEX "interview_rounds_normalized_name_key"
  ON "interview_rounds" (LOWER(TRIM("name")));

-- Backfill: every round name that exists anywhere today becomes exactly one
-- master row. Reading all three sources (per-demand override, global default,
-- already-materialized demand rows) means nothing that is already configurable
-- anywhere in the app becomes unavailable after this migration.
WITH existing_round_names AS (
  SELECT DISTINCT TRIM(BOTH ' ' FROM r ->> 'name') AS name
  FROM "demand_interview_config" c,
       LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(c."rounds") = 'array' THEN c."rounds" ELSE '[]'::jsonb END
       ) AS r
  WHERE NULLIF(TRIM(BOTH ' ' FROM r ->> 'name'), '') IS NOT NULL

  UNION

  SELECT DISTINCT TRIM(BOTH ' ' FROM r ->> 'name')
  FROM "super_admin_settings" s,
       LATERAL jsonb_array_elements(
         CASE WHEN jsonb_typeof(s."value") = 'array' THEN s."value" ELSE '[]'::jsonb END
       ) AS r
  WHERE s."key" = 'interview_rounds_default'
    AND NULLIF(TRIM(BOTH ' ' FROM r ->> 'name'), '') IS NOT NULL

  UNION

  SELECT DISTINCT TRIM(BOTH ' ' FROM "name")
  FROM "demand_interview_rounds"
  WHERE NULLIF(TRIM(BOTH ' ' FROM "name"), '') IS NOT NULL
)
INSERT INTO "interview_rounds" ("name", "sort_order", "is_active")
SELECT "name", 0, true FROM existing_round_names
ON CONFLICT DO NOTHING;

-- ── companies (master) ──────────────────────────────────────────────────────
-- Persistent master: deliberately NO deleted_at / is_deleted / deleted_by and
-- NO delete endpoint — a Company is referenced by Demands and by company-level
-- round configuration, so it must never be removable. `demands.company_id`
-- below is ON DELETE RESTRICT as a structural backstop.
--
-- client_name is nullable because Demand quick-create only collects a company
-- name; the API falls back to `name` when it is omitted (so the demand-level
-- client_name mirror, which the Client & Source Analytics report groups by,
-- is never empty).
CREATE TABLE "companies" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "client_name" VARCHAR(255),
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255),
  "phone" VARCHAR(50),
  "website" VARCHAR(255),
  "address" TEXT,
  "city" VARCHAR(100),
  "state" VARCHAR(100),
  "country" VARCHAR(100),
  "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by" UUID,
  "updated_by" UUID,

  CONSTRAINT "companies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "companies_status_check" CHECK ("status" IN ('ACTIVE', 'INACTIVE')),
  CONSTRAINT "companies_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id"),
  CONSTRAINT "companies_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id")
);

-- Same normalized-name uniqueness convention as interview_rounds /
-- candidates_normalized_email_key. Guarantees the Demand dropdown's quick-create
-- can never produce two "Cloudpeak Systems" rows.
CREATE UNIQUE INDEX "companies_normalized_name_key"
  ON "companies" (LOWER(TRIM("name")));

-- Backfill: one company per distinct normalized company name already present on
-- demands. company_name is the company's identity; client_name is the client
-- label; company_email is the only email we have. DISTINCT ON + the tie-break
-- ordering makes the choice deterministic (prefer a row that actually has an
-- email, then lowest demand id), so repeated runs cannot pick differently.
WITH demand_company_src AS (
  SELECT
    LOWER(TRIM(COALESCE(
      NULLIF(TRIM(BOTH ' ' FROM d."company_name"), ''),
      NULLIF(TRIM(BOTH ' ' FROM d."client_name"), '')
    ))) AS norm_name,
    NULLIF(TRIM(BOTH ' ' FROM d."company_name"), '') AS name_raw,
    NULLIF(TRIM(BOTH ' ' FROM d."client_name"), '')  AS client_raw,
    NULLIF(TRIM(BOTH ' ' FROM d."company_email"), '') AS email_raw,
    d."id" AS demand_id
  FROM "demands" d
  WHERE COALESCE(
    NULLIF(TRIM(BOTH ' ' FROM d."company_name"), ''),
    NULLIF(TRIM(BOTH ' ' FROM d."client_name"), '')
  ) IS NOT NULL
)
INSERT INTO "companies" ("client_name", "name", "email")
SELECT DISTINCT ON (s.norm_name)
       COALESCE(s.client_raw, s.name_raw),
       s.name_raw,
       s.email_raw
FROM demand_company_src s
ORDER BY s.norm_name,
         (s.email_raw IS NOT NULL) DESC,
         s.demand_id
ON CONFLICT DO NOTHING;

-- ── demands: reference the company master ───────────────────────────────────
ALTER TABLE "demands" ADD COLUMN "company_id" UUID;

ALTER TABLE "demands"
  ADD CONSTRAINT "demands_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE INDEX "demands_company_id_idx" ON "demands" ("company_id");

-- Point every existing demand at its company. client_name / company_name /
-- company_email are intentionally NOT cleared or dropped here: they are read by
-- the dashboard aging table, the Client & Source Analytics report (which groups
-- demands by exact client_name), both Excel exports, the demand search fields,
-- the AM mandate email template and the bulk-import column contract. The API
-- keeps them in sync as a write-through mirror of the selected company, so they
-- stay correct without any of those consumers changing.
UPDATE "demands" d
SET "company_id" = c."id"
FROM "companies" c
WHERE d."company_id" IS NULL
  AND LOWER(TRIM(COALESCE(
    NULLIF(TRIM(BOTH ' ' FROM d."company_name"), ''),
    NULLIF(TRIM(BOTH ' ' FROM d."client_name"), '')
  ))) = LOWER(TRIM(c."name"));

-- ── company_interview_rounds (company -> master round configuration) ────────
-- References, never copies: only the FK to interview_rounds plus this company's
-- own order/mandatory configuration is stored.
CREATE TABLE "company_interview_rounds" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "company_id" UUID NOT NULL,
  "round_id" UUID NOT NULL,
  "round_order" INTEGER NOT NULL,
  "mandatory" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "company_interview_rounds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "company_interview_rounds_round_order_check" CHECK ("round_order" > 0)
);

ALTER TABLE "company_interview_rounds"
  ADD CONSTRAINT "company_interview_rounds_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  ADD CONSTRAINT "company_interview_rounds_round_id_fkey"
  FOREIGN KEY ("round_id") REFERENCES "interview_rounds"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

CREATE UNIQUE INDEX "company_interview_rounds_company_id_round_order_key"
  ON "company_interview_rounds" ("company_id", "round_order");

CREATE UNIQUE INDEX "company_interview_rounds_company_id_round_id_key"
  ON "company_interview_rounds" ("company_id", "round_id");

CREATE INDEX "company_interview_rounds_company_id_idx" ON "company_interview_rounds" ("company_id");

-- ── demand_interview_rounds: link the projection back to the master ─────────
-- Nullable + additive. SET NULL (not RESTRICT): the materialized projection is
-- owned by the demand, and a round that is later deactivated must never cascade
-- into deleting a demand round that past interviews still reference.
ALTER TABLE "demand_interview_rounds" ADD COLUMN "master_round_id" UUID;

ALTER TABLE "demand_interview_rounds"
  ADD CONSTRAINT "demand_interview_rounds_master_round_id_fkey"
  FOREIGN KEY ("master_round_id") REFERENCES "interview_rounds"("id")
  ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE INDEX "demand_interview_rounds_master_round_id_idx" ON "demand_interview_rounds" ("master_round_id");

-- Link every already-materialized demand round to its master by normalized name.
UPDATE "demand_interview_rounds" dir
SET "master_round_id" = ir."id"
FROM "interview_rounds" ir
WHERE LOWER(TRIM(dir."name")) = LOWER(TRIM(ir."name"));