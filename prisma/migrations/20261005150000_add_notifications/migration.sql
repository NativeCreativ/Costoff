-- In-app notifications.
--
-- First notification subsystem in this app: a persistent, per-user inbox fed by backend
-- writes (currently Demand assignment). Delivered to the UI over REST + TanStack Query with
-- controlled polling — no WebSocket / SSE / Socket.IO.
--
-- Conventions follow the existing schema (uuid_generate_v4 PK, TIMESTAMPTZ(6), hand-written
-- migration SQL with the functional/extra indexes declared here rather than in schema.prisma
-- where Prisma cannot express them).
--
-- `dedupe_key` provides the idempotency guarantee required for assignment notifications: a
-- repeated assignment event for the same (demand, user, role) cannot produce a second row, so
-- even a retried request cannot double-notify. Nullable so future notification types that are
-- genuinely repeatable are not forced to invent a key.

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  -- Recipient. Always the profile the session resolved to; never taken from a request body.
  "user_id" UUID NOT NULL,
  "type" VARCHAR(50) NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "message" TEXT NOT NULL,
  -- What the notification is about, so the UI can navigate without hard-coding per-type logic
  -- (e.g. entity_type 'demand', entity_id = demands.id).
  "entity_type" VARCHAR(50),
  "entity_id" UUID,
  "is_read" BOOLEAN NOT NULL DEFAULT false,
  "read_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dedupe_key" VARCHAR(255),

  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_type_check" CHECK ("type" IN (
    'demand_assigned'
  )),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
);

-- Recipient scoping. Every read path filters on user_id, so this is the primary access index.
CREATE INDEX "notifications_user_id_idx" ON "notifications" ("user_id");

-- The unread badge/count and the "Unread" tab: both filter user_id + is_read.
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications" ("user_id", "is_read");

-- The cursor feed: user_id + created_at DESC (+ id as the tie-break), matching the
-- keyset pagination order exactly so the index can serve it without a sort.
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications" ("user_id", "created_at" DESC);

-- "Show me everything about this demand" (e.g. future in-context notification history).
CREATE INDEX "notifications_entity_idx" ON "notifications" ("entity_type", "entity_id");

-- Idempotency backstop for assignment events. Partial + unique: only rows that declare a
-- dedupe key participate, and a repeated event is rejected by the database itself rather than
-- relying on application-level checks alone.
CREATE UNIQUE INDEX "notifications_dedupe_key_key"
  ON "notifications" ("dedupe_key")
  WHERE "dedupe_key" IS NOT NULL;
