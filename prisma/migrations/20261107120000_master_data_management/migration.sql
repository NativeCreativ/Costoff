-- Master Data Management: client SPOCs, end clients, skill-group description,
-- skill type + classification, and the editable demand/interview masters.
-- Seeds insert missing rows only (ON CONFLICT DO NOTHING) so existing data is kept.

ALTER TABLE "skill_categories" ADD COLUMN "description" TEXT;

CREATE TABLE "skill_classifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(50) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "skill_classifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "skill_classifications_name_key" ON "skill_classifications"("name");

ALTER TABLE "skills" ADD COLUMN "skill_type" VARCHAR(20) NOT NULL DEFAULT 'optional';
ALTER TABLE "skills" ADD COLUMN "classification_id" UUID;
CREATE INDEX "skills_classification_id_idx" ON "skills"("classification_id");
ALTER TABLE "skills" ADD CONSTRAINT "skills_classification_id_fkey"
  FOREIGN KEY ("classification_id") REFERENCES "skill_classifications"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE "company_spocs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "company_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "designation" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "company_spocs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "company_spocs_company_id_idx" ON "company_spocs"("company_id");
ALTER TABLE "company_spocs" ADD CONSTRAINT "company_spocs_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE TABLE "end_clients" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "location" TEXT,
    "description" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "created_by" UUID,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "end_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "end_client_spocs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "end_client_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "designation" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "end_client_spocs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "end_client_spocs_end_client_id_idx" ON "end_client_spocs"("end_client_id");
ALTER TABLE "end_client_spocs" ADD CONSTRAINT "end_client_spocs_end_client_id_fkey"
  FOREIGN KEY ("end_client_id") REFERENCES "end_clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE "demands" ADD COLUMN "end_client_id" UUID;
ALTER TABLE "demands" ADD COLUMN "demand_type" VARCHAR(100);
ALTER TABLE "demands" ALTER COLUMN "role_category" TYPE VARCHAR(100);
CREATE INDEX "demands_end_client_id_idx" ON "demands"("end_client_id");
ALTER TABLE "demands" ADD CONSTRAINT "demands_end_client_id_fkey"
  FOREIGN KEY ("end_client_id") REFERENCES "end_clients"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

CREATE TABLE "demand_categories" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demand_categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "demand_categories_name_key" ON "demand_categories"("name");

CREATE TABLE "demand_phases" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demand_phases_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "demand_phases_name_key" ON "demand_phases"("name");

CREATE TABLE "locations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "locations_name_key" ON "locations"("name");

CREATE TABLE "demand_types" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "demand_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "demand_types_name_key" ON "demand_types"("name");

CREATE TABLE "interview_statuses" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(100) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_transition" BOOLEAN NOT NULL DEFAULT true,
    "requires_result" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interview_statuses_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "interview_statuses_name_key" ON "interview_statuses"("name");

INSERT INTO "skill_classifications" ("name", "sort_order") VALUES
  ('Technical', 1),
  ('Behavioural', 2),
  ('Domain', 3)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "demand_categories" ("name", "sort_order") VALUES
  ('FTE', 1),
  ('Contractor', 2),
  ('C2H', 3),
  ('Full Time', 4),
  ('Part Time', 5),
  ('Contract', 6),
  ('Temporary', 7),
  ('Internship', 8),
  ('Freelance', 9)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "demand_phases" ("name", "sort_order") VALUES
  ('Assign', 1),
  ('Sourcing', 2),
  ('Shortlist', 3),
  ('Selection', 4),
  ('Onboarding', 5),
  ('Closure', 6)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "locations" ("name", "sort_order") VALUES
  ('Bangalore', 1),
  ('Chennai', 2),
  ('Hyderabad', 3)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "demand_types" ("name", "sort_order") VALUES
  ('Technical', 1),
  ('Non-Technical', 2),
  ('Domain', 3),
  ('General', 4)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "interview_statuses" ("name", "sort_order", "is_transition", "requires_result") VALUES
  ('Scheduled', 1, false, false),
  ('Completed', 2, true, true),
  ('Candidate No-Show', 3, true, false),
  ('Client No-Show', 4, true, false)
ON CONFLICT ("name") DO NOTHING;
