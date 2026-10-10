-- When an audit email actually went out. Null until Resend accepts it.
-- audit_not_delivered lives in pipeline_status, not a new table.

ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "audit_sent_at" TIMESTAMPTZ(6);
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "audit_email_id" VARCHAR(120);
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "audit_delivery_error" TEXT;
