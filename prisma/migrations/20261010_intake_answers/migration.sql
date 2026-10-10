-- Progressive homepage intake. Additive. Existing leads stay put:
-- sort_last defaults false so they keep their current order.

ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "intake_answers" JSONB;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "jev_scores" JSONB;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "intake_token" VARCHAR(64);
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "sort_last" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "sort_last_reason" TEXT;
ALTER TABLE "facilities" ADD COLUMN IF NOT EXISTS "sort_last_cleared_at" TIMESTAMPTZ(6);

CREATE UNIQUE INDEX IF NOT EXISTS "facilities_intake_token_key"
  ON "facilities" ("intake_token");

CREATE INDEX IF NOT EXISTS "idx_facilities_sort_last"
  ON "facilities" ("sort_last");
