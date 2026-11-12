-- Experience levels: admin-managed options for the Demand form's "Experience Level" dropdown
-- (Demand Fulfillment Settings → Experience levels).
--
-- Purely a picker source. `demands.experience_level` stays a plain VARCHAR column and is never a
-- foreign key into this table, so renaming or deleting an option here never touches an
-- already-saved demand — the demand keeps whatever text it stored, and the Edit form surfaces it
-- as an extra pre-selected option until an admin re-adds a matching entry.

-- CreateTable
CREATE TABLE "experience_levels" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(30) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experience_levels_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
-- Functional index on the NORMALIZED name, mirroring companies_normalized_name_key: "5-8 years"
-- and "5-8 Years" are the same option to a user, so the database — not just the route — must
-- refuse the duplicate. A plain UNIQUE(name) would happily store both.
CREATE UNIQUE INDEX "experience_levels_name_key" ON "experience_levels"(LOWER(TRIM("name")));

-- Seed defaults (idempotent — ON CONFLICT DO NOTHING, so re-running this migration or re-adding
-- an option an admin already renamed never duplicates rows or clobbers their edits).
INSERT INTO "experience_levels" ("id", "name", "sort_order") VALUES
  (uuid_generate_v4(), 'Fresher (0-1 Years)', 1),
  (uuid_generate_v4(), '1-3 Years', 2),
  (uuid_generate_v4(), '3-5 Years', 3),
  (uuid_generate_v4(), '5-8 Years', 4),
  (uuid_generate_v4(), '8-12 Years', 5),
  (uuid_generate_v4(), '12+ Years', 6)
ON CONFLICT DO NOTHING;