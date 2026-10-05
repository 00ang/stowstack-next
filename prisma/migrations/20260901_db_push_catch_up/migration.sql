-- Catch-up: schema changes made with `prisma db push` between the 0_init
-- baseline (2026-06-29) and the first real migration (20260902), which never
-- had migration files. Without this, replaying prisma/migrations onto an empty
-- database does not produce schema.prisma, and 20260904_updated_at_defaults and
-- 20260905_speed_to_lead fail on columns that only `db push` ever created.
--
-- Generated 2026-10-05 with
--   prisma migrate diff --from-url <db after 0_init> \
--     --to-schema-datamodel <schema.prisma at 3198916, the commit before 20260902>
--
-- PRODUCTION ALREADY HAS ALL OF THIS (it ran there via `db push`). It is recorded
-- as applied there and must never be executed against production: it contains
-- DROP TABLE for five tables that were in 0_init but were already gone.
-- It runs only when building a fresh database from migrations.

-- DropForeignKey
ALTER TABLE "ab_test_events" DROP CONSTRAINT "ab_test_events_test_id_fkey";

-- DropForeignKey
ALTER TABLE "ab_tests" DROP CONSTRAINT "ab_tests_facility_id_fkey";

-- DropForeignKey
ALTER TABLE "audit_report_cache" DROP CONSTRAINT "audit_report_cache_facility_id_fkey";

-- DropForeignKey
ALTER TABLE "pms_reports" DROP CONSTRAINT "pms_reports_facility_id_fkey";

-- DropIndex
DROP INDEX "drip_sequences_facility_id_key";

-- AlterTable
ALTER TABLE "activity_log" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "ad_variations" ADD COLUMN     "funnel_id" UUID,
ALTER COLUMN "facility_id" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "api_keys" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "api_usage_log" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "assets" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "audience_syncs" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "audit_log" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "audits" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "call_logs" ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "call_tracking_numbers" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "campaign_spend" ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "changelog_entries" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "churn_predictions" ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "client_campaigns" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "client_onboarding" ALTER COLUMN "updated_at" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "client_reports" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "deleted_by" TEXT,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "commit_enrichments" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "commit_flags" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "commit_reviews" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "creative_briefs" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "delinquency_escalations" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "deployment_tags" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "dev_handoffs" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "drip_sequence_templates" ADD COLUMN     "funnel_id" UUID,
ADD COLUMN     "sequence_type" TEXT NOT NULL DEFAULT 'post_conversion',
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "drip_sequences" ADD COLUMN     "funnel_id" UUID,
ADD COLUMN     "lead_id" UUID;

-- AlterTable
ALTER TABLE "facilities" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "deleted_by" TEXT,
ADD COLUMN     "shared_audit_slug" VARCHAR(120),
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_context" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_market_intel" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_pms_aging" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_pms_length_of_stay" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_pms_rate_history" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_pms_rent_roll" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_pms_revenue_history" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_pms_snapshots" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_pms_specials" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_pms_tenant_rates" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "facility_pms_units" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "gbp_connections" ALTER COLUMN "sync_config" SET DEFAULT '{"auto_post": true, "sync_hours": true, "sync_photos": true, "auto_respond": true}',
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "gbp_insights" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "gbp_posts" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "gbp_profile_sync_log" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "gbp_questions" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "gbp_reviews" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "ideas" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "landing_pages" ADD COLUMN     "funnel_id" UUID,
ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lead_notes" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "marketing_plans" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "moveout_remarketing" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "notifications" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "nurture_enrollments" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "nurture_messages" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "nurture_sequences" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "org_users" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "deleted_by" TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "partial_leads" ADD COLUMN     "audit_submission_id" UUID,
ADD COLUMN     "call_log_id" UUID,
ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "funnel_id" UUID,
ADD COLUMN     "matched_tenant_id" UUID,
ADD COLUMN     "source_channel" VARCHAR(32),
ADD COLUMN     "source_subchannel" VARCHAR(64),
ADD COLUMN     "visitor_id" VARCHAR(64),
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "platform_connections" ALTER COLUMN "facility_id" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "pms_reports" ADD COLUMN     "file_size" INTEGER,
ADD COLUMN     "file_url" TEXT,
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "processed_at" TIMESTAMPTZ(6),
ADD COLUMN     "processed_by" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'uploaded',
ALTER COLUMN "facility_id" SET NOT NULL,
ALTER COLUMN "report_data" DROP NOT NULL;

-- AlterTable
ALTER TABLE "publish_log" ALTER COLUMN "facility_id" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "push_subscriptions" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "referral_codes" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "referral_credits" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "referrals" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "retention_campaigns" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "rev_share_payouts" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "sessions" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "shared_audits" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "social_posts" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "style_references" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "tenant_communications" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "tenant_payments" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "deleted_at" TIMESTAMPTZ(6),
ADD COLUMN     "deleted_by" TEXT,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "upsell_opportunities" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "utm_links" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "webhook_deliveries" ALTER COLUMN "created_at" SET NOT NULL;

-- AlterTable
ALTER TABLE "webhooks" ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "updated_at" SET NOT NULL;

-- DropTable
DROP TABLE "ab_test_events";

-- DropTable
DROP TABLE "ab_tests";

-- DropTable
DROP TABLE "audit_report_cache";

-- DropTable
DROP TABLE "betapad_notes";

-- DropTable
DROP TABLE "commit_comments";

-- CreateTable
CREATE TABLE "admin_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_email" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" VARCHAR(8) NOT NULL,
    "label" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY['*']::TEXT[],
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "period_month" DATE NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 0,
    "actual" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "sender" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_invoices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "ad_spend" DECIMAL(12,2),
    "fee" DECIMAL(12,2),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "period" TEXT,
    "description" TEXT,
    "stripe_invoice_id" TEXT,
    "issued_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ(6),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_match_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "partial_lead_id" UUID,
    "facility_id" UUID NOT NULL,
    "match_method" VARCHAR(32) NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "candidates" JSONB DEFAULT '[]',
    "reviewed_at" TIMESTAMPTZ(6),
    "reviewed_by" VARCHAR(64),
    "attempted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_match_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_status_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "partial_lead_id" UUID NOT NULL,
    "from_status" VARCHAR(32),
    "to_status" VARCHAR(32) NOT NULL,
    "changed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by" VARCHAR(64),
    "source" VARCHAR(32),
    "source_ref_id" UUID,
    "notes" TEXT,

    CONSTRAINT "lead_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_sensitivity_features" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL,
    "tenure_months" INTEGER NOT NULL,
    "months_since_last_increase" INTEGER,
    "payment_health_score" DOUBLE PRECISION NOT NULL,
    "late_payment_count_12mo" INTEGER NOT NULL DEFAULT 0,
    "autopay_flag" BOOLEAN NOT NULL DEFAULT false,
    "current_rate" DECIMAL(10,2),
    "market_rate" DECIMAL(10,2),
    "rate_gap_pct" DOUBLE PRECISION,
    "unit_size" TEXT,
    "has_insurance" BOOLEAN NOT NULL DEFAULT false,
    "sensitivity_score" DOUBLE PRECISION NOT NULL,
    "bucket" VARCHAR(16) NOT NULL,
    "factors" JSONB DEFAULT '{}',
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_sensitivity_features_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "noi_report_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "report_period" VARCHAR(16) NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_revenue" DECIMAL(12,2) DEFAULT 0,
    "rent_revenue" DECIMAL(12,2) DEFAULT 0,
    "fee_revenue" DECIMAL(12,2) DEFAULT 0,
    "auction_revenue" DECIMAL(12,2) DEFAULT 0,
    "new_move_ins" INTEGER DEFAULT 0,
    "move_outs" INTEGER DEFAULT 0,
    "net_units" INTEGER DEFAULT 0,
    "dynamic_pricing_lift" DECIMAL(12,2) DEFAULT 0,
    "ecri_realized_lift" DECIMAL(12,2) DEFAULT 0,
    "retention_saves" INTEGER DEFAULT 0,
    "retention_saves_value" DECIMAL(12,2) DEFAULT 0,
    "marketing_spend" DECIMAL(10,2) DEFAULT 0,
    "leads_generated" INTEGER DEFAULT 0,
    "attributed_move_ins" INTEGER DEFAULT 0,
    "attributed_revenue" DECIMAL(12,2) DEFAULT 0,
    "vs_prior_period_revenue_delta" DECIMAL(12,2) DEFAULT 0,
    "vs_year_ago_revenue_delta" DECIMAL(12,2) DEFAULT 0,
    "estimated_noi_lift" DECIMAL(12,2) DEFAULT 0,
    "platform_fee" DECIMAL(10,2) DEFAULT 0,
    "net_value_delivered" DECIMAL(12,2) DEFAULT 0,
    "pending_approvals" JSONB DEFAULT '[]',
    "source_notes" JSONB DEFAULT '{}',
    "computed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "noi_report_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctrine_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "doc_name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "change_summary" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctrine_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_performance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "variation_id" UUID NOT NULL,
    "funnel_id" UUID,
    "period" TEXT NOT NULL,
    "spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "ctr" DECIMAL(6,4),
    "cpc" DECIMAL(10,2),
    "leads" INTEGER NOT NULL DEFAULT 0,
    "move_ins" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "creative_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnels" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "archetype" VARCHAR(40),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB,
    "daily_budget" DECIMAL(10,2),
    "target_audience" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "published_at" TIMESTAMPTZ(6),
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "funnels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "funnel_stage_metrics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "funnel_id" UUID NOT NULL,
    "period" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "funnel_stage_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_learnings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "learnings_json" JSONB NOT NULL DEFAULT '{}',
    "last_synthesized" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "facility_learnings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "synthesis_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "trigger" TEXT NOT NULL,
    "facility_id" UUID,
    "target_doc" TEXT NOT NULL,
    "input_summary" TEXT,
    "change_summary" TEXT,
    "tokens_used" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "synthesis_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_profiles" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "name" TEXT NOT NULL,
    "tone_descriptors" JSONB NOT NULL DEFAULT '{}',
    "do_use" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "do_not_use" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "template" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_safety_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "event_type" TEXT NOT NULL,
    "surface" TEXT NOT NULL,
    "source_id" UUID,
    "ai_draft" TEXT,
    "escalation_reason" TEXT,
    "blocklist_term" TEXT,
    "human_decision" TEXT DEFAULT 'pending',
    "human_decided_by" TEXT,
    "human_decided_at" TIMESTAMPTZ(6),
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_safety_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_question_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" TEXT NOT NULL,
    "question_text" TEXT NOT NULL,
    "answer_template" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gbp_question_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photo_refresh_prompts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "prompt_month" DATE NOT NULL,
    "prompt_sent_at" TIMESTAMPTZ(6),
    "prompt_channel" TEXT NOT NULL DEFAULT 'email',
    "response_received_at" TIMESTAMPTZ(6),
    "uploaded_photo_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "uploaded_to_gbp_at" TIMESTAMPTZ(6),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "photo_refresh_prompts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_keys_key_hash_key" ON "admin_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_admin_keys_hash" ON "admin_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_admin_keys_email" ON "admin_keys"("user_email");

-- CreateIndex
CREATE INDEX "idx_client_goals_client" ON "client_goals"("client_id", "period_month" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uniq_client_goal_month" ON "client_goals"("client_id", "period_month");

-- CreateIndex
CREATE INDEX "idx_client_messages_client" ON "client_messages"("client_id");

-- CreateIndex
CREATE INDEX "idx_client_messages_thread" ON "client_messages"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_client_invoices_client" ON "client_invoices"("client_id");

-- CreateIndex
CREATE INDEX "idx_client_invoices_status" ON "client_invoices"("status");

-- CreateIndex
CREATE INDEX "idx_lead_match_tenant" ON "lead_match_attempts"("tenant_id", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX "idx_lead_match_facility_status" ON "lead_match_attempts"("facility_id", "status");

-- CreateIndex
CREATE INDEX "idx_lead_match_status" ON "lead_match_attempts"("status", "attempted_at" DESC);

-- CreateIndex
CREATE INDEX "idx_lead_status_events_lead" ON "lead_status_events"("partial_lead_id", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_lead_status_events_status" ON "lead_status_events"("to_status", "changed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_tenant_sensitivity_tenant" ON "tenant_sensitivity_features"("tenant_id", "snapshot_date" DESC);

-- CreateIndex
CREATE INDEX "idx_tenant_sensitivity_facility_bucket" ON "tenant_sensitivity_features"("facility_id", "bucket");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_sensitivity_features_tenant_id_snapshot_date_key" ON "tenant_sensitivity_features"("tenant_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "idx_noi_snapshots_facility" ON "noi_report_snapshots"("facility_id", "computed_at" DESC);

-- CreateIndex
CREATE INDEX "idx_noi_snapshots_period" ON "noi_report_snapshots"("report_period", "period_start" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "noi_report_snapshots_facility_id_report_period_period_start_key" ON "noi_report_snapshots"("facility_id", "report_period", "period_start");

-- CreateIndex
CREATE INDEX "idx_doctrine_versions_doc" ON "doctrine_versions"("doc_name");

-- CreateIndex
CREATE UNIQUE INDEX "doctrine_versions_doc_name_version_key" ON "doctrine_versions"("doc_name", "version");

-- CreateIndex
CREATE INDEX "idx_creative_performance_facility" ON "creative_performance"("facility_id");

-- CreateIndex
CREATE INDEX "idx_creative_performance_funnel" ON "creative_performance"("funnel_id");

-- CreateIndex
CREATE UNIQUE INDEX "creative_performance_variation_id_period_key" ON "creative_performance"("variation_id", "period");

-- CreateIndex
CREATE INDEX "idx_funnels_facility" ON "funnels"("facility_id");

-- CreateIndex
CREATE INDEX "idx_funnels_status" ON "funnels"("status");

-- CreateIndex
CREATE INDEX "idx_funnels_facility_status" ON "funnels"("facility_id", "status");

-- CreateIndex
CREATE INDEX "idx_funnel_stage_metrics_funnel" ON "funnel_stage_metrics"("funnel_id");

-- CreateIndex
CREATE INDEX "idx_funnel_stage_metrics_funnel_period" ON "funnel_stage_metrics"("funnel_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "funnel_stage_metrics_funnel_id_period_stage_key" ON "funnel_stage_metrics"("funnel_id", "period", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "facility_learnings_facility_id_key" ON "facility_learnings"("facility_id");

-- CreateIndex
CREATE INDEX "idx_synthesis_log_status" ON "synthesis_log"("status");

-- CreateIndex
CREATE INDEX "idx_voice_profiles_facility" ON "voice_profiles"("facility_id");

-- CreateIndex
CREATE INDEX "idx_voice_profiles_active" ON "voice_profiles"("active");

-- CreateIndex
CREATE INDEX "idx_ai_safety_facility" ON "ai_safety_events"("facility_id");

-- CreateIndex
CREATE INDEX "idx_ai_safety_type" ON "ai_safety_events"("event_type", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_ai_safety_surface" ON "ai_safety_events"("surface", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "gbp_question_templates_question_text_key" ON "gbp_question_templates"("question_text");

-- CreateIndex
CREATE INDEX "idx_gbp_q_templates_priority" ON "gbp_question_templates"("active", "priority" DESC);

-- CreateIndex
CREATE INDEX "idx_gbp_q_templates_category" ON "gbp_question_templates"("category");

-- CreateIndex
CREATE INDEX "idx_photo_prompts_due" ON "photo_refresh_prompts"("status", "prompt_sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "photo_refresh_prompts_facility_id_prompt_month_key" ON "photo_refresh_prompts"("facility_id", "prompt_month");

-- CreateIndex
CREATE INDEX "idx_variations_funnel" ON "ad_variations"("funnel_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_organization_id_name_key" ON "api_keys"("organization_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "client_reports_client_id_report_type_period_start_key" ON "client_reports"("client_id", "report_type", "period_start");

-- CreateIndex
CREATE INDEX "idx_clients_deleted_at" ON "clients"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_drip_templates_funnel" ON "drip_sequence_templates"("funnel_id");

-- CreateIndex
CREATE INDEX "idx_drip_sequences_facility" ON "drip_sequences"("facility_id");

-- CreateIndex
CREATE INDEX "idx_drip_sequences_funnel" ON "drip_sequences"("funnel_id");

-- CreateIndex
CREATE INDEX "idx_drip_sequences_lead" ON "drip_sequences"("lead_id");

-- CreateIndex
CREATE INDEX "idx_facilities_deleted_at" ON "facilities"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_landing_pages_funnel" ON "landing_pages"("funnel_id");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_stripe_customer_id_key" ON "organizations"("stripe_customer_id");

-- CreateIndex
CREATE INDEX "idx_organizations_deleted_at" ON "organizations"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_partial_leads_funnel" ON "partial_leads"("funnel_id");

-- CreateIndex
CREATE INDEX "idx_partial_leads_visitor" ON "partial_leads"("visitor_id");

-- CreateIndex
CREATE INDEX "idx_partial_leads_matched_tenant" ON "partial_leads"("matched_tenant_id");

-- CreateIndex
CREATE INDEX "idx_partial_leads_call_log" ON "partial_leads"("call_log_id");

-- CreateIndex
CREATE INDEX "idx_pms_reports_status" ON "pms_reports"("status");

-- CreateIndex
CREATE INDEX "idx_tenants_deleted_at" ON "tenants"("deleted_at");

-- AddForeignKey
ALTER TABLE "ad_variations" ADD CONSTRAINT "ad_variations_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "api_usage_log" ADD CONSTRAINT "api_usage_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "churn_predictions" ADD CONSTRAINT "churn_predictions_retention_campaign_id_fkey" FOREIGN KEY ("retention_campaign_id") REFERENCES "retention_campaigns"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_goals" ADD CONSTRAINT "client_goals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "drip_sequence_templates" ADD CONSTRAINT "drip_sequence_templates_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "partial_leads" ADD CONSTRAINT "partial_leads_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "partial_leads" ADD CONSTRAINT "partial_leads_call_log_id_fkey" FOREIGN KEY ("call_log_id") REFERENCES "call_logs"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "partial_leads" ADD CONSTRAINT "partial_leads_matched_tenant_id_fkey" FOREIGN KEY ("matched_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pms_reports" ADD CONSTRAINT "pms_reports_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "social_posts" ADD CONSTRAINT "social_posts_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nurture_sequences" ADD CONSTRAINT "nurture_sequences_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nurture_enrollments" ADD CONSTRAINT "nurture_enrollments_sequence_id_fkey" FOREIGN KEY ("sequence_id") REFERENCES "nurture_sequences"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nurture_enrollments" ADD CONSTRAINT "nurture_enrollments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nurture_enrollments" ADD CONSTRAINT "nurture_enrollments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "partial_leads"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nurture_enrollments" ADD CONSTRAINT "nurture_enrollments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "nurture_messages" ADD CONSTRAINT "nurture_messages_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "nurture_enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audience_syncs" ADD CONSTRAINT "audience_syncs_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audience_syncs" ADD CONSTRAINT "audience_syncs_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "platform_connections"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lead_status_events" ADD CONSTRAINT "lead_status_events_partial_lead_id_fkey" FOREIGN KEY ("partial_lead_id") REFERENCES "partial_leads"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_sensitivity_features" ADD CONSTRAINT "tenant_sensitivity_features_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "noi_report_snapshots" ADD CONSTRAINT "noi_report_snapshots_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "creative_performance" ADD CONSTRAINT "creative_performance_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_performance" ADD CONSTRAINT "creative_performance_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "ad_variations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_performance" ADD CONSTRAINT "creative_performance_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "funnels" ADD CONSTRAINT "funnels_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "funnel_stage_metrics" ADD CONSTRAINT "funnel_stage_metrics_funnel_id_fkey" FOREIGN KEY ("funnel_id") REFERENCES "funnels"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_learnings" ADD CONSTRAINT "facility_learnings_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_profiles" ADD CONSTRAINT "voice_profiles_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ai_safety_events" ADD CONSTRAINT "ai_safety_events_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "photo_refresh_prompts" ADD CONSTRAINT "photo_refresh_prompts_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

