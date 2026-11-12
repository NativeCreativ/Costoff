-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateTable
CREATE TABLE "candidates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "full_name" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "alternate_phone" VARCHAR(50),
    "email" VARCHAR(255),
    "qualification" VARCHAR(255),
    "available_from" DATE,
    "skills" TEXT[],
    "current_company" VARCHAR(255),
    "current_location" VARCHAR(255),
    "preferred_locations" TEXT[],
    "current_ctc" DECIMAL(10,2),
    "expected_ctc" DECIMAL(10,2),
    "source" VARCHAR(100) DEFAULT 'naukri',
    "availability" VARCHAR(100),
    "holding_other_offer" VARCHAR(100),
    "profile_archived" BOOLEAN DEFAULT false,
    "added_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_contacts" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "client_id" UUID,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "designation" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "industry" VARCHAR(100),
    "location" VARCHAR(255),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demand_ta_allocations" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "demand_id" UUID,
    "ta_id" UUID,
    "allocated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demand_ta_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demands" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "request_id" VARCHAR(50) NOT NULL,
    "external_requisition_id" VARCHAR(100),
    "buzzworks_id" VARCHAR(100),
    "client_id" UUID,
    "poc_id" UUID,
    "role_category" VARCHAR(50),
    "account_name" VARCHAR(255),
    "skill_description" TEXT NOT NULL,
    "technology_stack" TEXT[],
    "experience_level" VARCHAR(100),
    "locations" TEXT[],
    "budget_min" DECIMAL(12,2),
    "budget_max" DECIMAL(12,2),
    "num_positions" INTEGER DEFAULT 1,
    "status" VARCHAR(50) DEFAULT 'Open',
    "priority" VARCHAR(20) DEFAULT 'Medium',
    "created_by" UUID,
    "opened_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "comments" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dropdown_masters" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "category" VARCHAR(100) NOT NULL,
    "value" VARCHAR(255) NOT NULL,
    "sort_order" INTEGER DEFAULT 0,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dropdown_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interviews" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "submission_id" UUID,
    "demand_id" UUID,
    "candidate_id" UUID,
    "scheduled_by" UUID,
    "interviewer_name" VARCHAR(255),
    "level" VARCHAR(50),
    "skill_tested" VARCHAR(255),
    "mode" VARCHAR(50) DEFAULT 'Video',
    "scheduled_date" DATE NOT NULL,
    "scheduled_time" TIME(6),
    "status" VARCHAR(100) DEFAULT 'Scheduled',
    "link_status" VARCHAR(100),
    "feedback" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offers" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "submission_id" UUID,
    "demand_id" UUID,
    "candidate_id" UUID,
    "offered_ctc" DECIMAL(10,2),
    "offer_date" DATE DEFAULT CURRENT_DATE,
    "status" VARCHAR(50) DEFAULT 'Pending',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboardings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "offer_id" UUID,
    "demand_id" UUID,
    "candidate_id" UUID,
    "bgv_status" VARCHAR(50) DEFAULT 'in_progress',
    "actual_joining_date" DATE,
    "status" VARCHAR(100) DEFAULT 'yet_to_join',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "email" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "role" VARCHAR(50) NOT NULL,
    "phone" VARCHAR(50),
    "avatar_url" TEXT,
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "demand_id" UUID,
    "candidate_id" UUID,
    "submitted_by_ta" UUID,
    "managed_by_am" UUID,
    "stage" VARCHAR(100) DEFAULT 'submitted_for_am_review',
    "remarks" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profiles_email_key" ON "profiles"("email");

-- AddForeignKey
ALTER TABLE "candidates" ADD CONSTRAINT "candidates_added_by_fkey" FOREIGN KEY ("added_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_contacts" ADD CONSTRAINT "client_contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "demand_ta_allocations" ADD CONSTRAINT "demand_ta_allocations_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "demand_ta_allocations" ADD CONSTRAINT "demand_ta_allocations_ta_id_fkey" FOREIGN KEY ("ta_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_poc_id_fkey" FOREIGN KEY ("poc_id") REFERENCES "client_contacts"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_scheduled_by_fkey" FOREIGN KEY ("scheduled_by") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "interviews" ADD CONSTRAINT "interviews_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "offers" ADD CONSTRAINT "offers_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "onboardings" ADD CONSTRAINT "onboardings_offer_id_fkey" FOREIGN KEY ("offer_id") REFERENCES "offers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_candidate_id_fkey" FOREIGN KEY ("candidate_id") REFERENCES "candidates"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_demand_id_fkey" FOREIGN KEY ("demand_id") REFERENCES "demands"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_managed_by_am_fkey" FOREIGN KEY ("managed_by_am") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_submitted_by_ta_fkey" FOREIGN KEY ("submitted_by_ta") REFERENCES "profiles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
