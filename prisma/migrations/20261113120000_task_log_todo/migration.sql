-- Task Log (everyone records their own tasks) and To-Do List (AM / SPOC / Delivery Head publish
-- priority items to everyone for a period). New tables only.

CREATE TABLE "task_logs" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "user_id" UUID NOT NULL,
  "task_name" VARCHAR(200) NOT NULL,
  "details" TEXT,
  "start_date" DATE NOT NULL,
  "end_date" DATE,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "task_logs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "task_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "task_logs_dates_check" CHECK ("end_date" IS NULL OR "end_date" >= "start_date")
);
CREATE INDEX "task_logs_user_id_start_date_idx" ON "task_logs"("user_id", "start_date");
CREATE INDEX "task_logs_start_date_idx" ON "task_logs"("start_date");

CREATE TABLE "todo_items" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "title" VARCHAR(200) NOT NULL,
  "details" TEXT,
  "priority" VARCHAR(10) NOT NULL DEFAULT 'Medium',
  "active_from" DATE NOT NULL,
  "active_until" DATE NOT NULL,
  "status" VARCHAR(10) NOT NULL DEFAULT 'open',
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "published_at" TIMESTAMPTZ(6),
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "todo_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "todo_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
  CONSTRAINT "todo_items_dates_check" CHECK ("active_until" >= "active_from")
);
CREATE INDEX "todo_items_published_active_idx" ON "todo_items"("is_published", "active_from", "active_until");
CREATE INDEX "todo_items_created_by_idx" ON "todo_items"("created_by");
