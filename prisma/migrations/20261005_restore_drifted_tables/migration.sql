-- Schema drift found 2026-10-05: code that has queried these since June, against
-- objects that never existed in production. Every one of those queries failed.
--
--   alert_history            /api/cron/check-campaign-alerts writes, the client
--                            portal home reads (/api/alert-history)
--   page_interactions        every /lp/[slug] page beacons into it
--   page_interaction_stats   /api/cron/aggregate-page-stats rolls the above up
--   clients.report_enabled   /api/cron/send-client-reports filters on it
--   clients.report_frequency                    "                  reads it
--
-- PURELY ADDITIVE. Three new tables, two new columns with defaults, indexes.
-- Touches no existing rows. Idempotent — safe to run twice.
--
-- report_enabled defaults to FALSE: nothing has ever turned client reports on
-- (the column did not exist), so this keeps today's behaviour — no report emails
-- — until someone opts a client in. The DDL below is what `prisma migrate diff`
-- generates for the models in schema.prisma, plus IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS "alert_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "facility_id" UUID,
    "alert_type" VARCHAR(64) NOT NULL,
    "severity" VARCHAR(16) NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "metric" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledged_by" TEXT,
    "acknowledged_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_history_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "page_interactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "landing_page_id" UUID NOT NULL,
    "facility_id" UUID,
    "session_id" TEXT NOT NULL,
    "event_type" VARCHAR(32) NOT NULL,
    "element_id" TEXT,
    "element_text" TEXT,
    "section_index" INTEGER,
    "x_pct" DOUBLE PRECISION,
    "y_pct" DOUBLE PRECISION,
    "scroll_depth" INTEGER,
    "viewport_width" INTEGER,
    "viewport_height" INTEGER,
    "time_on_page" INTEGER NOT NULL DEFAULT 0,
    "utm_source" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_interactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "page_interaction_stats" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "landing_page_id" UUID NOT NULL,
    "period_date" DATE NOT NULL,
    "total_sessions" INTEGER NOT NULL DEFAULT 0,
    "avg_scroll_depth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avg_time_on_page" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "click_zones" JSONB,
    "section_views" JSONB,
    "cta_clicks" JSONB,
    "bounce_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "page_interaction_stats_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_alert_history_client_type" ON "alert_history"("client_id", "alert_type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_alert_history_client_ack" ON "alert_history"("client_id", "acknowledged");
CREATE INDEX IF NOT EXISTS "idx_page_interactions_page_time" ON "page_interactions"("landing_page_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_page_interactions_created" ON "page_interactions"("created_at");
-- The ON CONFLICT target of the daily rollup's upsert.
CREATE UNIQUE INDEX IF NOT EXISTS "page_interaction_stats_page_date_key" ON "page_interaction_stats"("landing_page_id", "period_date");

-- Metadata-only on Postgres 11+ (constant default): no table rewrite, no lock held.
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "report_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "report_frequency" VARCHAR(16) NOT NULL DEFAULT 'weekly';
