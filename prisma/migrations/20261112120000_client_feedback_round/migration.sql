-- Client feedback round (Nov 2026): demand form, client SPOCs, demand type -> skill groups,
-- per-client ordered onboarding steps and the demand change log. Adds only; nothing existing
-- is dropped or rewritten except the work_modes backfill below.

-- 1. Demand: multiple work modes + a Customer JD file next to the pasted text.
--    `work_mode` stays and keeps holding the first selected mode, so every older reader
--    (exports, aging query, imports) keeps working.
ALTER TABLE "demands" ADD COLUMN "work_modes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "demands" SET "work_modes" = ARRAY["work_mode"]::TEXT[]
  WHERE "work_mode" IS NOT NULL AND btrim("work_mode") <> '';
ALTER TABLE "demands" ADD COLUMN "customer_jd_file_url" TEXT;
ALTER TABLE "demands" ADD COLUMN "customer_jd_file_name" VARCHAR(255);

-- 2. Client SPOC list: vertical, supervisor and an active flag. Existing SPOCs stay active.
ALTER TABLE "company_spocs" ADD COLUMN "vertical" VARCHAR(100);
ALTER TABLE "company_spocs" ADD COLUMN "supervisor" VARCHAR(255);
ALTER TABLE "company_spocs" ADD COLUMN "supervisor_designation" VARCHAR(100);
ALTER TABLE "company_spocs" ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true;

-- 4. Demand Type -> Skill Groups. Narrows the Skill Group picker on the demand form.
CREATE TABLE "demand_type_skill_categories" (
  "demand_type_id" UUID NOT NULL,
  "skill_category_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "demand_type_skill_categories_pkey" PRIMARY KEY ("demand_type_id", "skill_category_id"),
  CONSTRAINT "demand_type_skill_categories_demand_type_id_fkey" FOREIGN KEY ("demand_type_id") REFERENCES "demand_types"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "demand_type_skill_categories_skill_category_id_fkey" FOREIGN KEY ("skill_category_id") REFERENCES "skill_categories"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "demand_type_skill_categories_skill_category_id_idx" ON "demand_type_skill_categories"("skill_category_id");

-- 7. Ordered onboarding steps. company_id NULL = the default list for clients without their own.
CREATE TABLE "onboarding_step_templates" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "company_id" UUID,
  "name" VARCHAR(150) NOT NULL,
  "details" TEXT,
  "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "onboarding_step_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "onboarding_step_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);
CREATE INDEX "onboarding_step_templates_company_id_idx" ON "onboarding_step_templates"("company_id");

CREATE TABLE "onboarding_steps" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "onboarding_id" UUID NOT NULL,
  "template_step_id" UUID,
  "name" VARCHAR(150) NOT NULL,
  "details" TEXT,
  "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
  "step_order" INTEGER NOT NULL,
  "status" VARCHAR(30) NOT NULL DEFAULT 'pending',
  "attachment_url" TEXT,
  "attachment_name" VARCHAR(255),
  "remark" TEXT,
  "completed_at" TIMESTAMPTZ(6),
  "updated_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "onboarding_steps_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "onboarding_steps_onboarding_id_fkey" FOREIGN KEY ("onboarding_id") REFERENCES "onboardings"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "onboarding_steps_template_step_id_fkey" FOREIGN KEY ("template_step_id") REFERENCES "onboarding_step_templates"("id") ON DELETE SET NULL ON UPDATE NO ACTION,
  CONSTRAINT "onboarding_steps_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "onboarding_steps_onboarding_id_step_order_idx" ON "onboarding_steps"("onboarding_id", "step_order");

-- Seed the default step list from the existing onboarding document checklist, in its order,
-- so nothing configured there is lost. Each document becomes a step that expects a file.
INSERT INTO "onboarding_step_templates" ("company_id", "name", "requires_attachment", "sort_order", "is_active")
SELECT NULL,
       LEFT(btrim(CASE jsonb_typeof(t.elem) WHEN 'string' THEN t.elem #>> '{}' ELSE t.elem ->> 'name' END), 150),
       true,
       (t.ord - 1)::int,
       CASE WHEN jsonb_typeof(t.elem) = 'object' AND t.elem ->> 'isActive' = 'false' THEN false ELSE true END
FROM "super_admin_settings" s
CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(s.value) = 'array' THEN s.value ELSE '[]'::jsonb END) WITH ORDINALITY AS t(elem, ord)
WHERE s.key = 'onboarding_document_checklist'
  AND btrim(COALESCE(CASE jsonb_typeof(t.elem) WHEN 'string' THEN t.elem #>> '{}' ELSE t.elem ->> 'name' END, '')) <> '';

-- 10. Demand change log: field-level changes on the demand and on its candidates.
--     Assignment, status and pipeline moves already have their own event tables and are read
--     alongside this one; they are not copied here.
CREATE TABLE "demand_change_events" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "demand_id" UUID NOT NULL,
  "scope" VARCHAR(20) NOT NULL,
  "entity_id" UUID,
  "entity_label" VARCHAR(255),
  "field" VARCHAR(100) NOT NULL,
  "old_value" TEXT,
  "new_value" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "demand_change_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "demand_change_events_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "demand_change_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
);
CREATE INDEX "demand_change_events_demand_id_created_at_idx" ON "demand_change_events"("demand_id", "created_at");
