-- CreateTable
CREATE TABLE "ab_test_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "test_id" UUID NOT NULL,
    "variant_id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "event_name" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_test_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ab_tests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "variants" JSONB NOT NULL,
    "metrics" JSONB NOT NULL,
    "landing_page_ids" UUID[],
    "start_date" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "end_date" TIMESTAMPTZ(6),
    "winner_variant_id" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ab_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "type" TEXT NOT NULL,
    "facility_id" UUID,
    "lead_name" TEXT,
    "facility_name" TEXT,
    "detail" TEXT,
    "meta" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_variations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "brief_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT NOT NULL,
    "format" TEXT,
    "angle" TEXT,
    "content_json" JSONB NOT NULL,
    "asset_urls" JSONB,
    "status" TEXT DEFAULT 'draft',
    "feedback" TEXT,
    "version" INTEGER DEFAULT 1,
    "compliance_status" TEXT,
    "compliance_flags" JSONB,
    "funnel_config" JSONB,
    "funnel_metrics" JSONB,

    CONSTRAINT "ad_variations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" VARCHAR(8) NOT NULL,
    "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rate_limit" INTEGER DEFAULT 100,
    "last_used_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "revoked" BOOLEAN DEFAULT false,
    "revoked_at" TIMESTAMPTZ(6),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_usage_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "api_key_id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INTEGER,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_usage_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_report_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "report_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_report_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "website_scrape_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "url" TEXT NOT NULL,
    "facility_id" UUID,
    "scrape_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_scrape_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "audit_json" JSONB NOT NULL,
    "overall_score" INTEGER,
    "grade" TEXT,

    CONSTRAINT "audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "betapad_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" TEXT NOT NULL,
    "entry_type" TEXT NOT NULL,
    "entry_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "betapad_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tracking_number_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "twilio_call_sid" TEXT NOT NULL,
    "caller_number" TEXT,
    "caller_city" TEXT,
    "caller_state" TEXT,
    "duration" INTEGER DEFAULT 0,
    "status" TEXT NOT NULL,
    "recording_url" TEXT,
    "call_outcome" VARCHAR(32),
    "campaign_source" TEXT,
    "move_in_linked" BOOLEAN NOT NULL DEFAULT false,
    "started_at" TIMESTAMPTZ(6) NOT NULL,
    "ended_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "call_tracking_numbers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "landing_page_id" UUID,
    "utm_link_id" UUID,
    "label" TEXT NOT NULL,
    "twilio_sid" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "forward_to" TEXT NOT NULL,
    "status" TEXT DEFAULT 'active',
    "call_count" INTEGER DEFAULT 0,
    "total_duration" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_tracking_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_spend" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "campaign_name" TEXT,
    "campaign_id" TEXT,
    "utm_campaign" TEXT,
    "spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "impressions" INTEGER DEFAULT 0,
    "clicks" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "campaign_spend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "churn_predictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "risk_level" TEXT NOT NULL,
    "predicted_vacate" DATE,
    "factors" JSONB NOT NULL,
    "recommended_actions" JSONB DEFAULT '[]',
    "retention_campaign_id" UUID,
    "retention_status" TEXT DEFAULT 'none',
    "last_scored_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "churn_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "spend" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "cpl" DECIMAL(10,2) DEFAULT 0,
    "move_ins" INTEGER DEFAULT 0,
    "cost_per_move_in" DECIMAL(10,2) DEFAULT 0,
    "roas" DECIMAL(6,2) DEFAULT 0,
    "occupancy_delta" DECIMAL(5,2) DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_onboarding" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "access_code" VARCHAR(16) NOT NULL,
    "steps" JSONB NOT NULL DEFAULT '{}',
    "completed_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_onboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "report_type" VARCHAR(32) NOT NULL DEFAULT 'monthly',
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "report_html" TEXT,
    "report_data" JSONB,
    "status" VARCHAR(16) NOT NULL DEFAULT 'generated',
    "sent_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facility_name" TEXT,
    "location" TEXT,
    "occupancy_range" TEXT,
    "total_units" TEXT,
    "access_code" VARCHAR(16) NOT NULL,
    "monthly_goal" INTEGER DEFAULT 0,
    "signed_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commit_comments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "commit_hash" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commit_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commit_enrichments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "commit_hash" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "dev_note" TEXT,
    "dev_name" TEXT,
    "commit_type" TEXT DEFAULT 'improvement',
    "laymans_summary" TEXT,
    "technical_summary" TEXT,
    "committed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commit_enrichments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commit_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "commit_hash" TEXT NOT NULL,
    "flag_type" TEXT NOT NULL,
    "reason" TEXT DEFAULT '',
    "flagged_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commit_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commit_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "commit_hash" TEXT NOT NULL,
    "reviewed_by" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'reviewed',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commit_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_briefs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER DEFAULT 1,
    "brief_json" JSONB NOT NULL,
    "platform_recommendation" TEXT[],
    "status" TEXT DEFAULT 'draft',

    CONSTRAINT "creative_briefs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delinquency_escalations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "stage" TEXT NOT NULL,
    "stage_entered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_stage_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "automated" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delinquency_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deployment_tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "commit_hash" TEXT NOT NULL,
    "environment" TEXT NOT NULL DEFAULT 'production',
    "deployed_by" TEXT NOT NULL,
    "version" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deployment_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev_handoffs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "from_dev" TEXT NOT NULL,
    "to_dev" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "commit_hash" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dev_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drip_sequence_templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "variation_id" UUID,
    "name" TEXT NOT NULL,
    "steps" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drip_sequence_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drip_sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "sequence_id" TEXT NOT NULL DEFAULT 'post_audit',
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolled_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "next_send_at" TIMESTAMPTZ(6),
    "paused_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "cancelled_at" TIMESTAMPTZ(6),
    "cancel_reason" TEXT,
    "history" JSONB DEFAULT '[]',

    CONSTRAINT "drip_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "occupancy_range" TEXT,
    "total_units" TEXT,
    "biggest_issue" TEXT,
    "notes" TEXT,
    "place_id" TEXT,
    "google_address" TEXT,
    "google_phone" TEXT,
    "website" TEXT,
    "google_rating" DECIMAL(2,1),
    "review_count" INTEGER,
    "google_maps_url" TEXT,
    "hours" JSONB,
    "status" TEXT DEFAULT 'intake',
    "pipeline_status" TEXT DEFAULT 'submitted',
    "follow_up_date" DATE,
    "pms_uploaded" BOOLEAN DEFAULT false,
    "access_code" VARCHAR(16),
    "form_notes" TEXT,
    "lead_score" INTEGER,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "organization_id" UUID,
    "baseline_occupancy" DOUBLE PRECISION,
    "baseline_date" DATE,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_context" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT,
    "file_url" TEXT,
    "metadata" JSONB,

    CONSTRAINT "facility_context_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_market_intel" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "last_scanned" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "competitors" JSONB DEFAULT '[]',
    "demand_drivers" JSONB DEFAULT '[]',
    "demographics" JSONB DEFAULT '{}',
    "manual_notes" TEXT,
    "operator_overrides" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_market_intel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_pms_aging" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "unit" TEXT NOT NULL,
    "tenant_name" TEXT,
    "bucket_0_30" DECIMAL(10,2) DEFAULT 0,
    "bucket_31_60" DECIMAL(10,2) DEFAULT 0,
    "bucket_61_90" DECIMAL(10,2) DEFAULT 0,
    "bucket_91_120" DECIMAL(10,2) DEFAULT 0,
    "bucket_120_plus" DECIMAL(10,2) DEFAULT 0,
    "total" DECIMAL(10,2) DEFAULT 0,
    "move_out_date" DATE,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_pms_aging_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_pms_length_of_stay" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "tenant_name" TEXT NOT NULL,
    "latest_unit" TEXT,
    "move_in" DATE,
    "move_out" DATE,
    "days_in_unit" INTEGER DEFAULT 0,
    "lead_source" TEXT,
    "lead_category" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_pms_length_of_stay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_pms_rate_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "unit_type" TEXT NOT NULL,
    "effective_date" DATE NOT NULL,
    "street_rate" DECIMAL(8,2),
    "web_rate" DECIMAL(8,2),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_pms_rate_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_pms_rent_roll" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "unit" TEXT NOT NULL,
    "size_label" TEXT,
    "tenant_name" TEXT,
    "account" TEXT,
    "rental_start" DATE,
    "paid_thru" DATE,
    "rent_rate" DECIMAL(8,2),
    "insurance_premium" DECIMAL(8,2),
    "total_due" DECIMAL(10,2) DEFAULT 0,
    "days_past_due" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_pms_rent_roll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_pms_revenue_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" TEXT NOT NULL,
    "quarter" INTEGER,
    "revenue" DECIMAL(12,2) DEFAULT 0,
    "monthly_tax" DECIMAL(10,2) DEFAULT 0,
    "move_ins" INTEGER DEFAULT 0,
    "move_outs" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_pms_revenue_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_pms_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "total_units" INTEGER,
    "occupied_units" INTEGER,
    "occupancy_pct" DECIMAL(5,2),
    "total_sqft" INTEGER,
    "occupied_sqft" INTEGER,
    "gross_potential" DECIMAL(12,2),
    "actual_revenue" DECIMAL(12,2),
    "delinquency_pct" DECIMAL(5,2),
    "move_ins_mtd" INTEGER DEFAULT 0,
    "move_outs_mtd" INTEGER DEFAULT 0,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_pms_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_pms_specials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "applies_to" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "discount_type" TEXT DEFAULT 'fixed',
    "discount_value" DECIMAL(8,2),
    "min_lease_months" INTEGER DEFAULT 1,
    "start_date" DATE,
    "end_date" DATE,
    "active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_pms_specials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_pms_tenant_rates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "snapshot_date" DATE NOT NULL DEFAULT CURRENT_DATE,
    "unit" TEXT NOT NULL,
    "size_label" TEXT,
    "unit_type" TEXT,
    "access_type" TEXT,
    "tenant_name" TEXT,
    "moved_in" DATE,
    "standard_rate" DECIMAL(8,2),
    "actual_rate" DECIMAL(8,2),
    "paid_rate" DECIMAL(8,2),
    "rate_variance" DECIMAL(8,2),
    "discount" DECIMAL(8,2) DEFAULT 0,
    "discount_desc" TEXT,
    "days_as_tenant" INTEGER DEFAULT 0,
    "ecri_flag" BOOLEAN DEFAULT false,
    "ecri_suggested" DECIMAL(8,2),
    "ecri_revenue_lift" DECIMAL(8,2),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_pms_tenant_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facility_pms_units" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "unit_type" TEXT NOT NULL,
    "size_label" TEXT,
    "width_ft" DECIMAL(6,1),
    "depth_ft" DECIMAL(6,1),
    "sqft" DECIMAL(8,1),
    "floor" TEXT,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "total_count" INTEGER NOT NULL DEFAULT 0,
    "occupied_count" INTEGER NOT NULL DEFAULT 0,
    "vacant_count" INTEGER GENERATED ALWAYS AS (total_count - occupied_count) STORED,
    "street_rate" DECIMAL(8,2),
    "actual_avg_rate" DECIMAL(8,2),
    "web_rate" DECIMAL(8,2),
    "push_rate" DECIMAL(8,2),
    "ecri_eligible" INTEGER DEFAULT 0,
    "last_updated" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_pms_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fb_deletion_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "confirmation_code" TEXT NOT NULL,
    "fb_user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "fb_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_login_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "code" VARCHAR(8) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portal_login_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_deletion_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT,
    "reason" TEXT,
    "source" TEXT NOT NULL DEFAULT 'user_request',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "data_found" JSONB DEFAULT '{}',
    "data_deleted" JSONB DEFAULT '{}',
    "admin_notes" TEXT,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledged_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "completed_by" TEXT,

    CONSTRAINT "data_deletion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "google_account_id" TEXT,
    "location_id" TEXT,
    "location_name" TEXT,
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "status" TEXT DEFAULT 'disconnected',
    "last_sync_at" TIMESTAMPTZ(6),
    "sync_config" JSONB DEFAULT '{"auto_post": false, "sync_hours": true, "sync_photos": true, "auto_respond": false}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gbp_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_insights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "search_views" INTEGER DEFAULT 0,
    "maps_views" INTEGER DEFAULT 0,
    "website_clicks" INTEGER DEFAULT 0,
    "direction_clicks" INTEGER DEFAULT 0,
    "phone_calls" INTEGER DEFAULT 0,
    "photo_views" INTEGER DEFAULT 0,
    "post_views" INTEGER DEFAULT 0,
    "post_clicks" INTEGER DEFAULT 0,
    "total_searches" INTEGER DEFAULT 0,
    "direct_searches" INTEGER DEFAULT 0,
    "discovery_searches" INTEGER DEFAULT 0,
    "raw_data" JSONB DEFAULT '{}',
    "synced_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gbp_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "gbp_connection_id" UUID,
    "post_type" TEXT NOT NULL DEFAULT 'update',
    "title" TEXT,
    "body" TEXT NOT NULL,
    "cta_type" TEXT,
    "cta_url" TEXT,
    "image_url" TEXT,
    "offer_code" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "status" TEXT DEFAULT 'draft',
    "scheduled_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "external_post_id" TEXT,
    "error_message" TEXT,
    "ai_generated" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gbp_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_profile_sync_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "sync_type" TEXT NOT NULL,
    "status" TEXT DEFAULT 'success',
    "changes" JSONB DEFAULT '{}',
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gbp_profile_sync_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_questions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "gbp_connection_id" UUID,
    "external_question_id" TEXT,
    "author_name" TEXT,
    "question_text" TEXT NOT NULL,
    "question_time" TIMESTAMPTZ(6),
    "answer_text" TEXT,
    "answer_status" TEXT DEFAULT 'pending',
    "ai_draft" TEXT,
    "answered_at" TIMESTAMPTZ(6),
    "upvote_count" INTEGER DEFAULT 0,
    "synced_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gbp_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gbp_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "gbp_connection_id" UUID,
    "external_review_id" TEXT,
    "author_name" TEXT,
    "rating" INTEGER NOT NULL,
    "review_text" TEXT,
    "review_time" TIMESTAMPTZ(6),
    "response_text" TEXT,
    "response_status" TEXT DEFAULT 'pending',
    "ai_draft" TEXT,
    "responded_at" TIMESTAMPTZ(6),
    "synced_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gbp_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ideas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT DEFAULT '',
    "category" TEXT DEFAULT 'general',
    "priority" TEXT DEFAULT 'medium',
    "status" TEXT DEFAULT 'new',
    "votes" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_page_sections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "landing_page_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "section_type" VARCHAR(40) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "landing_page_sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_pages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "variation_ids" UUID[],
    "meta_title" VARCHAR(120),
    "meta_description" VARCHAR(300),
    "og_image_url" TEXT,
    "theme" JSONB NOT NULL DEFAULT '{}',
    "storedge_widget_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(6),

    CONSTRAINT "landing_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_notes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "marketing_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER DEFAULT 1,
    "status" TEXT DEFAULT 'draft',
    "plan_json" JSONB NOT NULL,
    "spend_recommendation" JSONB,
    "assigned_playbooks" TEXT[],
    "generated_from" JSONB,

    CONSTRAINT "marketing_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "moveout_remarketing" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "moved_out_date" DATE NOT NULL,
    "move_out_reason" TEXT,
    "sequence_status" TEXT DEFAULT 'pending',
    "current_step" INTEGER DEFAULT 0,
    "total_steps" INTEGER DEFAULT 5,
    "last_sent_at" TIMESTAMPTZ(6),
    "next_send_at" TIMESTAMPTZ(6),
    "opened_count" INTEGER DEFAULT 0,
    "clicked_count" INTEGER DEFAULT 0,
    "converted" BOOLEAN DEFAULT false,
    "converted_at" TIMESTAMPTZ(6),
    "new_tenant_id" UUID,
    "offer_type" TEXT,
    "offer_value" DECIMAL(10,2) DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "moveout_remarketing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "org_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "password_hash" TEXT,
    "invite_token" VARCHAR(64),
    "invite_expires_at" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "status" TEXT DEFAULT 'invited',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "reset_token" VARCHAR(64),
    "reset_token_expires_at" TIMESTAMPTZ(6),
    "is_superadmin" BOOLEAN DEFAULT false,
    "email_verified" BOOLEAN DEFAULT false,
    "email_verify_token" VARCHAR(64),
    "email_verify_expires_at" TIMESTAMPTZ(6),
    "avatar_url" TEXT,
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN DEFAULT false,
    "totp_backup_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "email_preferences" JSONB DEFAULT '{"payment_failed":true,"trial_ending":true,"ab_test_winner":true,"campaign_alert":true,"weekly_report":true,"team_changes":true,"product_updates":false}',
    "last_changelog_viewed_at" TIMESTAMPTZ(6),

    CONSTRAINT "org_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "logo_url" TEXT,
    "primary_color" VARCHAR(7) DEFAULT '#16a34a',
    "accent_color" VARCHAR(7) DEFAULT '#4f46e5',
    "custom_domain" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "billing_email" TEXT,
    "plan" TEXT DEFAULT 'starter',
    "facility_limit" INTEGER DEFAULT 10,
    "white_label" BOOLEAN DEFAULT false,
    "status" TEXT DEFAULT 'active',
    "rev_share_enabled" BOOLEAN DEFAULT true,
    "rev_share_pct" DECIMAL(5,2),
    "rev_share_tier" TEXT DEFAULT 'auto',
    "lifetime_earnings" DECIMAL(12,2) DEFAULT 0,
    "payout_method" TEXT DEFAULT 'bank_transfer',
    "payout_email" TEXT,
    "settings" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "stripe_customer_id" TEXT,
    "stripe_subscription_id" TEXT,
    "subscription_status" TEXT DEFAULT 'incomplete',
    "trial_ends_at" TIMESTAMPTZ(6),
    "signup_source" TEXT,
    "onboarding_completed_at" TIMESTAMPTZ(6),
    "onboarding_steps" JSONB DEFAULT '{}',
    "scheduled_deletion_at" TIMESTAMPTZ(6),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partial_leads" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "landing_page_id" UUID,
    "facility_id" UUID,
    "session_id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "unit_size" TEXT,
    "fields_completed" INTEGER DEFAULT 0,
    "total_fields" INTEGER DEFAULT 0,
    "scroll_depth" INTEGER DEFAULT 0,
    "time_on_page" INTEGER DEFAULT 0,
    "exit_intent" BOOLEAN DEFAULT false,
    "utm_source" TEXT,
    "utm_medium" TEXT,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "referrer" TEXT,
    "user_agent" TEXT,
    "ip_hash" TEXT,
    "recovery_status" TEXT DEFAULT 'pending',
    "recovery_sent_count" INTEGER DEFAULT 0,
    "next_recovery_at" TIMESTAMPTZ(6),
    "converted" BOOLEAN DEFAULT false,
    "converted_at" TIMESTAMPTZ(6),
    "lead_score" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "lead_status" TEXT DEFAULT 'partial',
    "monthly_revenue" DECIMAL(10,2),
    "move_in_date" DATE,
    "fbclid" TEXT,
    "gclid" TEXT,
    "status_updated_at" TIMESTAMPTZ(6),
    "lead_notes" TEXT,

    CONSTRAINT "partial_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "places_data" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "fetched_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "photos" JSONB,
    "reviews" JSONB,

    CONSTRAINT "places_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_connections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT NOT NULL,
    "status" TEXT DEFAULT 'disconnected',
    "access_token" TEXT,
    "refresh_token" TEXT,
    "token_expires_at" TIMESTAMPTZ(6),
    "account_id" TEXT,
    "account_name" TEXT,
    "page_id" TEXT,
    "page_name" TEXT,
    "metadata" JSONB,

    CONSTRAINT "platform_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pms_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "facility_name" TEXT,
    "email" TEXT,
    "report_type" TEXT DEFAULT 'unknown',
    "file_name" TEXT DEFAULT 'report.csv',
    "report_data" JSONB NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pms_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "variation_id" UUID,
    "connection_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "platform" TEXT NOT NULL,
    "status" TEXT DEFAULT 'pending',
    "external_id" TEXT,
    "external_url" TEXT,
    "error_message" TEXT,
    "request_payload" JSONB,
    "response_payload" JSONB,

    CONSTRAINT "publish_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_type" TEXT NOT NULL DEFAULT 'admin',
    "user_id" TEXT,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "active" BOOLEAN DEFAULT true,
    "last_used_at" TIMESTAMPTZ(6),
    "user_agent" TEXT,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_codes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "referrer_name" TEXT NOT NULL,
    "referrer_email" TEXT NOT NULL,
    "credit_balance" DECIMAL(10,2) DEFAULT 0,
    "total_earned" DECIMAL(10,2) DEFAULT 0,
    "referral_count" INTEGER DEFAULT 0,
    "status" TEXT DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referral_credits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referral_code_id" UUID NOT NULL,
    "referral_id" UUID,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "description" TEXT NOT NULL,
    "balance_after" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referral_credits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "referral_code_id" UUID NOT NULL,
    "referred_name" TEXT NOT NULL,
    "referred_email" TEXT NOT NULL,
    "referred_phone" TEXT,
    "facility_name" TEXT,
    "facility_location" TEXT,
    "status" TEXT DEFAULT 'invited',
    "credit_amount" DECIMAL(10,2) DEFAULT 0,
    "credit_issued" BOOLEAN DEFAULT false,
    "credit_issued_at" TIMESTAMPTZ(6),
    "signed_up_at" TIMESTAMPTZ(6),
    "activated_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_campaigns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_risk_level" TEXT DEFAULT 'high',
    "sequence_steps" JSONB NOT NULL,
    "active" BOOLEAN DEFAULT true,
    "enrolled_count" INTEGER DEFAULT 0,
    "retained_count" INTEGER DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "retention_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rev_share_payouts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "month" TEXT NOT NULL,
    "facility_count" INTEGER NOT NULL DEFAULT 0,
    "gross_mrr" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "rev_share_pct" DECIMAL(5,2) NOT NULL,
    "payout_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" TEXT DEFAULT 'pending',
    "paid_at" TIMESTAMPTZ(6),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rev_share_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rev_share_referrals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "referred_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "first_revenue_at" TIMESTAMPTZ(6),
    "status" TEXT DEFAULT 'active',
    "total_earned" DECIMAL(10,2) DEFAULT 0,

    CONSTRAINT "rev_share_referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "last_active_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shared_audits" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(60) NOT NULL,
    "facility_name" TEXT,
    "audit_json" JSONB NOT NULL,
    "views" INTEGER DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shared_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_communications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT,
    "status" TEXT DEFAULT 'sent',
    "related_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_communications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "method" TEXT,
    "status" TEXT DEFAULT 'paid',
    "days_late" INTEGER DEFAULT 0,
    "external_ref" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "external_id" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "unit_number" TEXT NOT NULL,
    "unit_size" TEXT,
    "unit_type" TEXT,
    "monthly_rate" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "move_in_date" DATE NOT NULL,
    "lease_end_date" DATE,
    "autopay_enabled" BOOLEAN DEFAULT false,
    "has_insurance" BOOLEAN DEFAULT false,
    "insurance_monthly" DECIMAL(10,2) DEFAULT 0,
    "balance" DECIMAL(10,2) DEFAULT 0,
    "status" TEXT DEFAULT 'active',
    "days_delinquent" INTEGER DEFAULT 0,
    "last_payment_date" DATE,
    "moved_out_date" DATE,
    "move_out_reason" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upsell_opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "current_value" DECIMAL(10,2) DEFAULT 0,
    "proposed_value" DECIMAL(10,2) DEFAULT 0,
    "monthly_uplift" DECIMAL(10,2) DEFAULT 0,
    "confidence" INTEGER DEFAULT 50,
    "status" TEXT DEFAULT 'identified',
    "outreach_method" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "responded_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "upsell_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utm_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "landing_page_id" UUID,
    "label" TEXT NOT NULL,
    "utm_source" TEXT NOT NULL,
    "utm_medium" TEXT NOT NULL,
    "utm_campaign" TEXT,
    "utm_content" TEXT,
    "utm_term" TEXT,
    "short_code" VARCHAR(16) NOT NULL,
    "click_count" INTEGER DEFAULT 0,
    "last_clicked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utm_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "webhook_id" UUID NOT NULL,
    "event" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" INTEGER,
    "response_body" TEXT,
    "duration_ms" INTEGER,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhooks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "secret" TEXT NOT NULL,
    "active" BOOLEAN DEFAULT true,
    "failure_count" INTEGER DEFAULT 0,
    "last_triggered_at" TIMESTAMPTZ(6),
    "last_status" INTEGER,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_posts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "post_type" TEXT DEFAULT 'tip',
    "content" TEXT NOT NULL,
    "hashtags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "media_urls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cta_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "scheduled_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "external_post_id" TEXT,
    "external_url" TEXT,
    "error_message" TEXT,
    "engagement" JSONB,
    "ai_generated" BOOLEAN DEFAULT false,
    "batch_id" UUID,
    "suggested_image" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "social_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurture_sequences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "trigger_type" TEXT,
    "steps" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nurture_sequences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurture_enrollments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sequence_id" UUID NOT NULL,
    "facility_id" UUID NOT NULL,
    "lead_id" UUID,
    "tenant_id" UUID,
    "contact_name" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "current_step" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "enrolled_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "next_send_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "exit_reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nurture_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "nurture_messages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enrollment_id" UUID NOT NULL,
    "step_number" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "to_address" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "external_id" TEXT,
    "sent_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "clicked_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "nurture_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_syncs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID NOT NULL,
    "connection_id" UUID,
    "audience_type" TEXT NOT NULL,
    "audience_name" TEXT NOT NULL,
    "meta_audience_id" TEXT,
    "source_type" TEXT,
    "record_count" INTEGER DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "last_synced_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audience_syncs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_references" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "facility_id" UUID,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "image_url" TEXT NOT NULL,
    "title" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "analysis" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "style_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT,
    "resource_id" UUID,
    "metadata" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "changelog_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT DEFAULT 'improvement',
    "published_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "changelog_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_ab_test_events_dedup" ON "ab_test_events"("test_id", "variant_id", "visitor_id", "event_name");

-- CreateIndex
CREATE INDEX "idx_ab_test_events_test" ON "ab_test_events"("test_id");

-- CreateIndex
CREATE INDEX "idx_ab_tests_facility" ON "ab_tests"("facility_id");

-- CreateIndex
CREATE INDEX "idx_ab_tests_status" ON "ab_tests"("status");

-- CreateIndex
CREATE INDEX "idx_activity_log_created" ON "activity_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_activity_log_facility" ON "activity_log"("facility_id");

-- CreateIndex
CREATE INDEX "idx_variations_brief" ON "ad_variations"("brief_id");

-- CreateIndex
CREATE INDEX "idx_variations_facility" ON "ad_variations"("facility_id");

-- CreateIndex
CREATE INDEX "idx_variations_status" ON "ad_variations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_api_keys_hash" ON "api_keys"("key_hash");

-- CreateIndex
CREATE INDEX "idx_api_keys_org" ON "api_keys"("organization_id");

-- CreateIndex
CREATE INDEX "idx_api_keys_prefix" ON "api_keys"("key_prefix");

-- CreateIndex
CREATE INDEX "idx_api_usage_created" ON "api_usage_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_api_usage_key" ON "api_usage_log"("api_key_id");

-- CreateIndex
CREATE INDEX "idx_api_usage_org" ON "api_usage_log"("organization_id");

-- CreateIndex
CREATE INDEX "idx_assets_facility" ON "assets"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_report_cache_facility_id_key" ON "audit_report_cache"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "website_scrape_cache_url_key" ON "website_scrape_cache"("url");

-- CreateIndex
CREATE INDEX "idx_scrape_cache_url" ON "website_scrape_cache"("url");

-- CreateIndex
CREATE INDEX "idx_audits_facility" ON "audits"("facility_id");

-- CreateIndex
CREATE INDEX "idx_betapad_notes_created" ON "betapad_notes"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_betapad_notes_session" ON "betapad_notes"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_logs_twilio_call_sid_key" ON "call_logs"("twilio_call_sid");

-- CreateIndex
CREATE INDEX "idx_call_logs_created" ON "call_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_call_logs_facility" ON "call_logs"("facility_id");

-- CreateIndex
CREATE INDEX "idx_call_logs_status" ON "call_logs"("status");

-- CreateIndex
CREATE INDEX "idx_call_logs_tracking" ON "call_logs"("tracking_number_id");

-- CreateIndex
CREATE UNIQUE INDEX "call_tracking_numbers_twilio_sid_key" ON "call_tracking_numbers"("twilio_sid");

-- CreateIndex
CREATE INDEX "idx_call_tracking_facility" ON "call_tracking_numbers"("facility_id");

-- CreateIndex
CREATE INDEX "idx_call_tracking_phone" ON "call_tracking_numbers"("phone_number");

-- CreateIndex
CREATE INDEX "idx_call_tracking_status" ON "call_tracking_numbers"("status");

-- CreateIndex
CREATE INDEX "idx_campaign_spend_facility" ON "campaign_spend"("facility_id");

-- CreateIndex
CREATE INDEX "idx_campaign_spend_utm" ON "campaign_spend"("utm_campaign");

-- CreateIndex
CREATE UNIQUE INDEX "campaign_spend_facility_id_platform_campaign_id_date_key" ON "campaign_spend"("facility_id", "platform", "campaign_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "churn_predictions_tenant_id_key" ON "churn_predictions"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_churn_predictions_facility" ON "churn_predictions"("facility_id");

-- CreateIndex
CREATE INDEX "idx_churn_predictions_level" ON "churn_predictions"("risk_level");

-- CreateIndex
CREATE INDEX "idx_churn_predictions_risk" ON "churn_predictions"("risk_score" DESC);

-- CreateIndex
CREATE INDEX "idx_client_campaigns_client" ON "client_campaigns"("client_id");

-- CreateIndex
CREATE UNIQUE INDEX "client_campaigns_client_id_month_key" ON "client_campaigns"("client_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "client_onboarding_client_id_key" ON "client_onboarding"("client_id");

-- CreateIndex
CREATE INDEX "idx_client_onboarding_code" ON "client_onboarding"("access_code");

-- CreateIndex
CREATE INDEX "idx_client_reports_client" ON "client_reports"("client_id");

-- CreateIndex
CREATE INDEX "idx_client_reports_facility" ON "client_reports"("facility_id");

-- CreateIndex
CREATE INDEX "idx_client_reports_period" ON "client_reports"("period_start", "period_end");

-- CreateIndex
CREATE UNIQUE INDEX "clients_access_code_key" ON "clients"("access_code");

-- CreateIndex
CREATE INDEX "idx_clients_access_code" ON "clients"("access_code");

-- CreateIndex
CREATE INDEX "idx_clients_facility" ON "clients"("facility_id");

-- CreateIndex
CREATE INDEX "idx_commit_comments_hash" ON "commit_comments"("commit_hash");

-- CreateIndex
CREATE UNIQUE INDEX "commit_enrichments_commit_hash_key" ON "commit_enrichments"("commit_hash");

-- CreateIndex
CREATE INDEX "idx_commit_enrichments_hash" ON "commit_enrichments"("commit_hash");

-- CreateIndex
CREATE INDEX "idx_commit_flags_hash" ON "commit_flags"("commit_hash");

-- CreateIndex
CREATE UNIQUE INDEX "idx_commit_reviews_unique" ON "commit_reviews"("commit_hash", "reviewed_by");

-- CreateIndex
CREATE INDEX "idx_briefs_facility" ON "creative_briefs"("facility_id");

-- CreateIndex
CREATE INDEX "idx_delinquency_escalations_facility" ON "delinquency_escalations"("facility_id");

-- CreateIndex
CREATE INDEX "idx_delinquency_escalations_stage" ON "delinquency_escalations"("stage");

-- CreateIndex
CREATE INDEX "idx_delinquency_escalations_tenant" ON "delinquency_escalations"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_deployment_tags_env" ON "deployment_tags"("environment");

-- CreateIndex
CREATE INDEX "idx_deployment_tags_hash" ON "deployment_tags"("commit_hash");

-- CreateIndex
CREATE INDEX "idx_dev_handoffs_status" ON "dev_handoffs"("status");

-- CreateIndex
CREATE INDEX "idx_drip_templates_facility" ON "drip_sequence_templates"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "drip_sequence_templates_facility_id_variation_id_key" ON "drip_sequence_templates"("facility_id", "variation_id");

-- CreateIndex
CREATE UNIQUE INDEX "drip_sequences_facility_id_key" ON "drip_sequences"("facility_id");

-- CreateIndex
CREATE INDEX "idx_drip_sequences_next_send" ON "drip_sequences"("next_send_at");

-- CreateIndex
CREATE INDEX "idx_drip_sequences_status" ON "drip_sequences"("status");

-- CreateIndex
CREATE UNIQUE INDEX "facilities_access_code_key" ON "facilities"("access_code");

-- CreateIndex
CREATE INDEX "idx_facilities_access_code" ON "facilities"("access_code");

-- CreateIndex
CREATE INDEX "idx_facilities_contact_email" ON "facilities"("contact_email");

-- CreateIndex
CREATE INDEX "idx_facilities_organization" ON "facilities"("organization_id");

-- CreateIndex
CREATE INDEX "idx_facilities_pipeline_status" ON "facilities"("pipeline_status");

-- CreateIndex
CREATE INDEX "idx_facilities_status" ON "facilities"("status");

-- CreateIndex
CREATE INDEX "idx_facility_context_facility" ON "facility_context"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_market_intel_facility_id_key" ON "facility_market_intel"("facility_id");

-- CreateIndex
CREATE INDEX "idx_market_intel_facility" ON "facility_market_intel"("facility_id");

-- CreateIndex
CREATE INDEX "idx_pms_aging_facility" ON "facility_pms_aging"("facility_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "idx_pms_los_facility" ON "facility_pms_length_of_stay"("facility_id");

-- CreateIndex
CREATE INDEX "idx_pms_rate_history_facility" ON "facility_pms_rate_history"("facility_id");

-- CreateIndex
CREATE INDEX "idx_pms_rent_roll_facility" ON "facility_pms_rent_roll"("facility_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "idx_pms_revenue_history_facility" ON "facility_pms_revenue_history"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_pms_revenue_history_facility_id_year_month_key" ON "facility_pms_revenue_history"("facility_id", "year", "month");

-- CreateIndex
CREATE INDEX "idx_pms_snapshots_facility" ON "facility_pms_snapshots"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_pms_snapshots_facility_id_snapshot_date_key" ON "facility_pms_snapshots"("facility_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "idx_pms_specials_facility" ON "facility_pms_specials"("facility_id");

-- CreateIndex
CREATE INDEX "idx_pms_tenant_rates_facility" ON "facility_pms_tenant_rates"("facility_id", "snapshot_date");

-- CreateIndex
CREATE INDEX "idx_pms_units_facility" ON "facility_pms_units"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "facility_pms_units_facility_id_unit_type_key" ON "facility_pms_units"("facility_id", "unit_type");

-- CreateIndex
CREATE UNIQUE INDEX "fb_deletion_requests_confirmation_code_key" ON "fb_deletion_requests"("confirmation_code");

-- CreateIndex
CREATE INDEX "idx_fb_deletion_code" ON "fb_deletion_requests"("confirmation_code");

-- CreateIndex
CREATE INDEX "idx_portal_login_email_code" ON "portal_login_codes"("email", "code");

-- CreateIndex
CREATE INDEX "idx_portal_login_expires" ON "portal_login_codes"("expires_at");

-- CreateIndex
CREATE INDEX "idx_data_deletion_email" ON "data_deletion_requests"("email");

-- CreateIndex
CREATE INDEX "idx_data_deletion_status" ON "data_deletion_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_connections_facility_id_key" ON "gbp_connections"("facility_id");

-- CreateIndex
CREATE INDEX "idx_gbp_connections_facility" ON "gbp_connections"("facility_id");

-- CreateIndex
CREATE INDEX "idx_gbp_connections_status" ON "gbp_connections"("status");

-- CreateIndex
CREATE INDEX "idx_gbp_insights_facility" ON "gbp_insights"("facility_id");

-- CreateIndex
CREATE INDEX "idx_gbp_insights_period" ON "gbp_insights"("period_start" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "gbp_insights_facility_id_period_start_period_end_key" ON "gbp_insights"("facility_id", "period_start", "period_end");

-- CreateIndex
CREATE INDEX "idx_gbp_posts_facility" ON "gbp_posts"("facility_id");

-- CreateIndex
CREATE INDEX "idx_gbp_posts_status" ON "gbp_posts"("status");

-- CreateIndex
CREATE INDEX "idx_gbp_sync_log_created" ON "gbp_profile_sync_log"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_gbp_sync_log_facility" ON "gbp_profile_sync_log"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_questions_external_question_id_key" ON "gbp_questions"("external_question_id");

-- CreateIndex
CREATE INDEX "idx_gbp_questions_facility" ON "gbp_questions"("facility_id");

-- CreateIndex
CREATE INDEX "idx_gbp_questions_status" ON "gbp_questions"("answer_status");

-- CreateIndex
CREATE UNIQUE INDEX "gbp_reviews_external_review_id_key" ON "gbp_reviews"("external_review_id");

-- CreateIndex
CREATE INDEX "idx_gbp_reviews_facility" ON "gbp_reviews"("facility_id");

-- CreateIndex
CREATE INDEX "idx_gbp_reviews_rating" ON "gbp_reviews"("rating");

-- CreateIndex
CREATE INDEX "idx_gbp_reviews_response" ON "gbp_reviews"("response_status");

-- CreateIndex
CREATE INDEX "idx_ideas_category" ON "ideas"("category");

-- CreateIndex
CREATE INDEX "idx_ideas_status" ON "ideas"("status");

-- CreateIndex
CREATE INDEX "idx_lp_sections_page" ON "landing_page_sections"("landing_page_id");

-- CreateIndex
CREATE UNIQUE INDEX "landing_pages_slug_key" ON "landing_pages"("slug");

-- CreateIndex
CREATE INDEX "idx_landing_pages_facility" ON "landing_pages"("facility_id");

-- CreateIndex
CREATE INDEX "idx_landing_pages_slug" ON "landing_pages"("slug");

-- CreateIndex
CREATE INDEX "idx_landing_pages_status" ON "landing_pages"("status");

-- CreateIndex
CREATE INDEX "idx_lead_notes_facility" ON "lead_notes"("facility_id");

-- CreateIndex
CREATE INDEX "idx_marketing_plans_facility" ON "marketing_plans"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "moveout_remarketing_tenant_id_key" ON "moveout_remarketing"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_moveout_remarketing_facility" ON "moveout_remarketing"("facility_id");

-- CreateIndex
CREATE INDEX "idx_moveout_remarketing_status" ON "moveout_remarketing"("sequence_status");

-- CreateIndex
CREATE INDEX "idx_org_users_email" ON "org_users"("email");

-- CreateIndex
CREATE INDEX "idx_org_users_invite" ON "org_users"("invite_token");

-- CreateIndex
CREATE INDEX "idx_org_users_org" ON "org_users"("organization_id");

-- CreateIndex
CREATE INDEX "idx_org_users_reset" ON "org_users"("reset_token");

-- CreateIndex
CREATE INDEX "idx_org_users_status" ON "org_users"("status");

-- CreateIndex
CREATE INDEX "idx_org_users_verify_token" ON "org_users"("email_verify_token");

-- CreateIndex
CREATE UNIQUE INDEX "org_users_organization_id_email_key" ON "org_users"("organization_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "idx_organizations_custom_domain" ON "organizations"("custom_domain");

-- CreateIndex
CREATE INDEX "idx_organizations_slug" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "idx_organizations_status" ON "organizations"("status");

-- CreateIndex
CREATE INDEX "idx_organizations_stripe_customer" ON "organizations"("stripe_customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "partial_leads_session_id_key" ON "partial_leads"("session_id");

-- CreateIndex
CREATE INDEX "idx_partial_leads_created" ON "partial_leads"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_partial_leads_email" ON "partial_leads"("email");

-- CreateIndex
CREATE INDEX "idx_partial_leads_facility_created" ON "partial_leads"("facility_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_partial_leads_facility_status" ON "partial_leads"("facility_id", "lead_status");

-- CreateIndex
CREATE INDEX "idx_partial_leads_landing_page" ON "partial_leads"("landing_page_id");

-- CreateIndex
CREATE INDEX "idx_partial_leads_lead_status" ON "partial_leads"("lead_status");

-- CreateIndex
CREATE INDEX "idx_partial_leads_recovery" ON "partial_leads"("recovery_status", "next_recovery_at");

-- CreateIndex
CREATE INDEX "idx_partial_leads_session" ON "partial_leads"("session_id");

-- CreateIndex
CREATE INDEX "idx_partial_leads_utm_campaign" ON "partial_leads"("utm_campaign");

-- CreateIndex
CREATE INDEX "idx_places_facility" ON "places_data"("facility_id");

-- CreateIndex
CREATE INDEX "idx_platform_connections_facility" ON "platform_connections"("facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_connections_facility_id_platform_key" ON "platform_connections"("facility_id", "platform");

-- CreateIndex
CREATE INDEX "idx_pms_reports_facility" ON "pms_reports"("facility_id");

-- CreateIndex
CREATE INDEX "idx_publish_log_facility" ON "publish_log"("facility_id");

-- CreateIndex
CREATE INDEX "idx_publish_log_variation" ON "publish_log"("variation_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "idx_push_subs_user" ON "push_subscriptions"("user_type", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "referral_codes_code_key" ON "referral_codes"("code");

-- CreateIndex
CREATE INDEX "idx_referral_codes_code" ON "referral_codes"("code");

-- CreateIndex
CREATE INDEX "idx_referral_codes_email" ON "referral_codes"("referrer_email");

-- CreateIndex
CREATE INDEX "idx_referral_codes_facility" ON "referral_codes"("facility_id");

-- CreateIndex
CREATE INDEX "idx_referral_credits_code" ON "referral_credits"("referral_code_id");

-- CreateIndex
CREATE INDEX "idx_referral_credits_type" ON "referral_credits"("type");

-- CreateIndex
CREATE INDEX "idx_referrals_code" ON "referrals"("referral_code_id");

-- CreateIndex
CREATE INDEX "idx_referrals_email" ON "referrals"("referred_email");

-- CreateIndex
CREATE INDEX "idx_referrals_status" ON "referrals"("status");

-- CreateIndex
CREATE INDEX "idx_retention_campaigns_facility" ON "retention_campaigns"("facility_id");

-- CreateIndex
CREATE INDEX "idx_rev_share_payouts_month" ON "rev_share_payouts"("month");

-- CreateIndex
CREATE INDEX "idx_rev_share_payouts_org" ON "rev_share_payouts"("organization_id");

-- CreateIndex
CREATE INDEX "idx_rev_share_payouts_status" ON "rev_share_payouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "rev_share_payouts_organization_id_month_key" ON "rev_share_payouts"("organization_id", "month");

-- CreateIndex
CREATE INDEX "idx_rev_share_referrals_org" ON "rev_share_referrals"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "rev_share_referrals_organization_id_facility_id_key" ON "rev_share_referrals"("organization_id", "facility_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_sessions_expires" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "idx_sessions_token" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "idx_sessions_user" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "shared_audits_slug_key" ON "shared_audits"("slug");

-- CreateIndex
CREATE INDEX "idx_shared_audits_slug" ON "shared_audits"("slug");

-- CreateIndex
CREATE INDEX "idx_tenant_comms_facility" ON "tenant_communications"("facility_id");

-- CreateIndex
CREATE INDEX "idx_tenant_comms_tenant" ON "tenant_communications"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_tenant_comms_type" ON "tenant_communications"("type");

-- CreateIndex
CREATE INDEX "idx_tenant_payments_date" ON "tenant_payments"("payment_date" DESC);

-- CreateIndex
CREATE INDEX "idx_tenant_payments_facility" ON "tenant_payments"("facility_id");

-- CreateIndex
CREATE INDEX "idx_tenant_payments_tenant" ON "tenant_payments"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_tenants_external" ON "tenants"("facility_id", "external_id");

-- CreateIndex
CREATE INDEX "idx_tenants_facility" ON "tenants"("facility_id");

-- CreateIndex
CREATE INDEX "idx_tenants_status" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "idx_upsell_facility" ON "upsell_opportunities"("facility_id");

-- CreateIndex
CREATE INDEX "idx_upsell_status" ON "upsell_opportunities"("status");

-- CreateIndex
CREATE INDEX "idx_upsell_tenant" ON "upsell_opportunities"("tenant_id");

-- CreateIndex
CREATE INDEX "idx_upsell_type" ON "upsell_opportunities"("type");

-- CreateIndex
CREATE UNIQUE INDEX "utm_links_short_code_key" ON "utm_links"("short_code");

-- CreateIndex
CREATE INDEX "idx_utm_links_facility" ON "utm_links"("facility_id");

-- CreateIndex
CREATE INDEX "idx_utm_links_short_code" ON "utm_links"("short_code");

-- CreateIndex
CREATE INDEX "idx_webhook_deliveries_created" ON "webhook_deliveries"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_webhook_deliveries_webhook" ON "webhook_deliveries"("webhook_id");

-- CreateIndex
CREATE INDEX "idx_webhooks_org" ON "webhooks"("organization_id");

-- CreateIndex
CREATE INDEX "idx_social_posts_facility" ON "social_posts"("facility_id");

-- CreateIndex
CREATE INDEX "idx_social_posts_status" ON "social_posts"("status");

-- CreateIndex
CREATE INDEX "idx_social_posts_scheduled" ON "social_posts"("scheduled_at");

-- CreateIndex
CREATE INDEX "idx_nurture_sequences_facility" ON "nurture_sequences"("facility_id");

-- CreateIndex
CREATE INDEX "idx_nurture_enrollments_seq" ON "nurture_enrollments"("sequence_id");

-- CreateIndex
CREATE INDEX "idx_nurture_enrollments_facility" ON "nurture_enrollments"("facility_id");

-- CreateIndex
CREATE INDEX "idx_nurture_enrollments_due" ON "nurture_enrollments"("status", "next_send_at");

-- CreateIndex
CREATE INDEX "idx_nurture_messages_enrollment" ON "nurture_messages"("enrollment_id");

-- CreateIndex
CREATE INDEX "idx_audience_syncs_facility" ON "audience_syncs"("facility_id");

-- CreateIndex
CREATE INDEX "idx_style_references_facility" ON "style_references"("facility_id");

-- CreateIndex
CREATE INDEX "idx_style_references_active" ON "style_references"("active");

-- CreateIndex
CREATE INDEX "idx_notifications_user" ON "notifications"("user_id", "read_at", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_notifications_org" ON "notifications"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_org" ON "audit_log"("organization_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_user" ON "audit_log"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_audit_log_action" ON "audit_log"("action");

-- CreateIndex
CREATE INDEX "idx_changelog_published" ON "changelog_entries"("published_at" DESC);

-- AddForeignKey
ALTER TABLE "ab_test_events" ADD CONSTRAINT "ab_test_events_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "ab_tests"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ab_tests" ADD CONSTRAINT "ab_tests_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_variations" ADD CONSTRAINT "ad_variations_brief_id_fkey" FOREIGN KEY ("brief_id") REFERENCES "creative_briefs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ad_variations" ADD CONSTRAINT "ad_variations_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "api_usage_log" ADD CONSTRAINT "api_usage_log_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_report_cache" ADD CONSTRAINT "audit_report_cache_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "website_scrape_cache" ADD CONSTRAINT "website_scrape_cache_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audits" ADD CONSTRAINT "audits_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "call_logs" ADD CONSTRAINT "call_logs_tracking_number_id_fkey" FOREIGN KEY ("tracking_number_id") REFERENCES "call_tracking_numbers"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "call_tracking_numbers" ADD CONSTRAINT "call_tracking_numbers_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "call_tracking_numbers" ADD CONSTRAINT "call_tracking_numbers_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "landing_pages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "call_tracking_numbers" ADD CONSTRAINT "call_tracking_numbers_utm_link_id_fkey" FOREIGN KEY ("utm_link_id") REFERENCES "utm_links"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "campaign_spend" ADD CONSTRAINT "campaign_spend_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "churn_predictions" ADD CONSTRAINT "churn_predictions_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "churn_predictions" ADD CONSTRAINT "churn_predictions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_campaigns" ADD CONSTRAINT "client_campaigns_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_onboarding" ADD CONSTRAINT "client_onboarding_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_reports" ADD CONSTRAINT "client_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "client_reports" ADD CONSTRAINT "client_reports_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "creative_briefs" ADD CONSTRAINT "creative_briefs_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "delinquency_escalations" ADD CONSTRAINT "delinquency_escalations_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "delinquency_escalations" ADD CONSTRAINT "delinquency_escalations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "drip_sequence_templates" ADD CONSTRAINT "drip_sequence_templates_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "drip_sequence_templates" ADD CONSTRAINT "drip_sequence_templates_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "ad_variations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "drip_sequences" ADD CONSTRAINT "drip_sequences_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facilities" ADD CONSTRAINT "facilities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_context" ADD CONSTRAINT "facility_context_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_market_intel" ADD CONSTRAINT "facility_market_intel_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_pms_aging" ADD CONSTRAINT "facility_pms_aging_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_pms_length_of_stay" ADD CONSTRAINT "facility_pms_length_of_stay_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_pms_rate_history" ADD CONSTRAINT "facility_pms_rate_history_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_pms_rent_roll" ADD CONSTRAINT "facility_pms_rent_roll_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_pms_revenue_history" ADD CONSTRAINT "facility_pms_revenue_history_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_pms_snapshots" ADD CONSTRAINT "facility_pms_snapshots_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_pms_specials" ADD CONSTRAINT "facility_pms_specials_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_pms_tenant_rates" ADD CONSTRAINT "facility_pms_tenant_rates_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "facility_pms_units" ADD CONSTRAINT "facility_pms_units_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gbp_connections" ADD CONSTRAINT "gbp_connections_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gbp_insights" ADD CONSTRAINT "gbp_insights_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gbp_posts" ADD CONSTRAINT "gbp_posts_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gbp_posts" ADD CONSTRAINT "gbp_posts_gbp_connection_id_fkey" FOREIGN KEY ("gbp_connection_id") REFERENCES "gbp_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gbp_profile_sync_log" ADD CONSTRAINT "gbp_profile_sync_log_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gbp_questions" ADD CONSTRAINT "gbp_questions_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gbp_questions" ADD CONSTRAINT "gbp_questions_gbp_connection_id_fkey" FOREIGN KEY ("gbp_connection_id") REFERENCES "gbp_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gbp_reviews" ADD CONSTRAINT "gbp_reviews_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "gbp_reviews" ADD CONSTRAINT "gbp_reviews_gbp_connection_id_fkey" FOREIGN KEY ("gbp_connection_id") REFERENCES "gbp_connections"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "landing_page_sections" ADD CONSTRAINT "landing_page_sections_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "landing_pages"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "landing_pages" ADD CONSTRAINT "landing_pages_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lead_notes" ADD CONSTRAINT "lead_notes_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "marketing_plans" ADD CONSTRAINT "marketing_plans_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "moveout_remarketing" ADD CONSTRAINT "moveout_remarketing_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "moveout_remarketing" ADD CONSTRAINT "moveout_remarketing_new_tenant_id_fkey" FOREIGN KEY ("new_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "moveout_remarketing" ADD CONSTRAINT "moveout_remarketing_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "org_users" ADD CONSTRAINT "org_users_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "partial_leads" ADD CONSTRAINT "partial_leads_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "partial_leads" ADD CONSTRAINT "partial_leads_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "landing_pages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "places_data" ADD CONSTRAINT "places_data_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "platform_connections" ADD CONSTRAINT "platform_connections_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pms_reports" ADD CONSTRAINT "pms_reports_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publish_log" ADD CONSTRAINT "publish_log_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "platform_connections"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publish_log" ADD CONSTRAINT "publish_log_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "publish_log" ADD CONSTRAINT "publish_log_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "ad_variations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referral_credits" ADD CONSTRAINT "referral_credits_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "referral_codes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referral_credits" ADD CONSTRAINT "referral_credits_referral_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "referrals"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referral_code_id_fkey" FOREIGN KEY ("referral_code_id") REFERENCES "referral_codes"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "retention_campaigns" ADD CONSTRAINT "retention_campaigns_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rev_share_payouts" ADD CONSTRAINT "rev_share_payouts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rev_share_referrals" ADD CONSTRAINT "rev_share_referrals_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "rev_share_referrals" ADD CONSTRAINT "rev_share_referrals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "org_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_communications" ADD CONSTRAINT "tenant_communications_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_communications" ADD CONSTRAINT "tenant_communications_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenant_payments" ADD CONSTRAINT "tenant_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tenants" ADD CONSTRAINT "tenants_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "upsell_opportunities" ADD CONSTRAINT "upsell_opportunities_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "upsell_opportunities" ADD CONSTRAINT "upsell_opportunities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "utm_links" ADD CONSTRAINT "utm_links_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "utm_links" ADD CONSTRAINT "utm_links_landing_page_id_fkey" FOREIGN KEY ("landing_page_id") REFERENCES "landing_pages"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_webhook_id_fkey" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "style_references" ADD CONSTRAINT "style_references_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "org_users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "org_users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

