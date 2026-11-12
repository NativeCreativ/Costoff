-- email_log / whatsapp_log quick-log actions were removed from the product (candidate
-- detail panel no longer offers "Log Email" / "Log WhatsApp" buttons, and the app-layer
-- enum no longer accepts them). Tighten the DB check constraint to match, so the two
-- layers can't drift.
ALTER TABLE "submission_events" DROP CONSTRAINT "submission_events_event_type_check";

ALTER TABLE "submission_events"
  ADD CONSTRAINT "submission_events_event_type_check" CHECK ("event_type" IN (
    'status_change', 'note', 'call_log',
    'interview_scheduled', 'interview_feedback', 'document_uploaded',
    'bgv_update', 'remark'
  ));
