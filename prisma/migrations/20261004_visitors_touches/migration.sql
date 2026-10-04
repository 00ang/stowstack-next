-- MISSION.md s12 — Visitor, Touch and conversion write-back.
-- PURELY ADDITIVE. Three new tables plus indexes; touches nothing existing.
--
-- visitors           one row per browser, keyed by the first-party `sa_vid` cookie
-- touches            one row per arrival that carries a source, plus inbound calls
-- conversion_reports one row per (platform, event) we report a move-in for

CREATE TABLE IF NOT EXISTS "visitors" (
  -- The cookie value itself. VARCHAR(64) to match partial_leads.visitor_id,
  -- which this finally populates.
  "id"              VARCHAR(64) PRIMARY KEY,
  "partial_lead_id" UUID,
  "first_seen_at"   TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "last_seen_at"    TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "identified_at"   TIMESTAMPTZ(6),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "visitors" ADD CONSTRAINT "visitors_partial_lead_id_fkey"
    FOREIGN KEY ("partial_lead_id") REFERENCES "partial_leads"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "idx_visitors_lead" ON "visitors" ("partial_lead_id");

CREATE TABLE IF NOT EXISTS "touches" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "visitor_id"      VARCHAR(64),
  "partial_lead_id" UUID,
  "facility_id"     UUID,
  "landing_page_id" UUID,
  "kind"            VARCHAR(16) NOT NULL,
  "channel"         VARCHAR(32) NOT NULL,
  "source"          VARCHAR(64),
  -- External identity of the fact (a Twilio CallSid). Unique per kind, so a
  -- webhook delivered twice records one touch.
  "source_ref"      VARCHAR(128),
  "occurred_at"     TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "url"             VARCHAR(2000),
  "referrer"        VARCHAR(2000),
  "utm_source"      VARCHAR(200),
  "utm_medium"      VARCHAR(200),
  "utm_campaign"    VARCHAR(200),
  "utm_content"     VARCHAR(200),
  "utm_term"        VARCHAR(200),
  "gclid"           VARCHAR(512),
  "gbraid"          VARCHAR(512),
  "wbraid"          VARCHAR(512),
  "fbclid"          VARCHAR(512),
  "fbc"             VARCHAR(512),
  "fbp"             VARCHAR(128),
  "ttclid"          VARCHAR(512),
  "msclkid"         VARCHAR(512),
  -- sha256 of the caller's last ten digits, call touches only. Lets a call be
  -- joined to a lead by phone without copying the number somewhere new.
  "phone_hash"      VARCHAR(64),
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "touches" ADD CONSTRAINT "touches_visitor_id_fkey"
    FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "touches" ADD CONSTRAINT "touches_partial_lead_id_fkey"
    FOREIGN KEY ("partial_lead_id") REFERENCES "partial_leads"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "touches" ADD CONSTRAINT "touches_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- A CONSTRAINT rather than a bare index so it matches Prisma's @@unique.
-- NULL source_ref (every web visit) repeats freely.
ALTER TABLE "touches" DROP CONSTRAINT IF EXISTS "touches_kind_source_ref";
ALTER TABLE "touches" ADD  CONSTRAINT "touches_kind_source_ref" UNIQUE ("kind","source_ref");

CREATE INDEX IF NOT EXISTS "idx_touches_visitor"  ON "touches" ("visitor_id","occurred_at");
CREATE INDEX IF NOT EXISTS "idx_touches_lead"     ON "touches" ("partial_lead_id","occurred_at");
CREATE INDEX IF NOT EXISTS "idx_touches_facility" ON "touches" ("facility_id","occurred_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_touches_phone"    ON "touches" ("facility_id","phone_hash");

CREATE TABLE IF NOT EXISTS "conversion_reports" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "facility_id"     UUID,
  "partial_lead_id" UUID,
  "tenant_id"       UUID,
  "platform"        VARCHAR(16) NOT NULL,
  -- What the platform dedupes on: Meta event_id, Google order_id. Same value
  -- on every retry, so a retry can never count a move-in twice.
  "event_id"        VARCHAR(128) NOT NULL,
  -- sent | skipped | failed
  "status"          VARCHAR(16) NOT NULL,
  "reason"          VARCHAR(64),
  "detail"          TEXT,
  "click_id_type"   VARCHAR(16),
  "value"           DECIMAL(10,2),
  "currency"        VARCHAR(3) NOT NULL DEFAULT 'USD',
  "conversion_at"   TIMESTAMPTZ(6),
  "sent_at"         TIMESTAMPTZ(6),
  "attempts"        INTEGER NOT NULL DEFAULT 0,
  "created_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"      TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

DO $$ BEGIN
  ALTER TABLE "conversion_reports" ADD CONSTRAINT "conversion_reports_partial_lead_id_fkey"
    FOREIGN KEY ("partial_lead_id") REFERENCES "partial_leads"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "conversion_reports" ADD CONSTRAINT "conversion_reports_facility_id_fkey"
    FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "conversion_reports" DROP CONSTRAINT IF EXISTS "conversion_reports_platform_event_id";
ALTER TABLE "conversion_reports" ADD  CONSTRAINT "conversion_reports_platform_event_id" UNIQUE ("platform","event_id");

CREATE INDEX IF NOT EXISTS "idx_conversion_reports_status"   ON "conversion_reports" ("status","created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_conversion_reports_facility" ON "conversion_reports" ("facility_id","created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_conversion_reports_lead"     ON "conversion_reports" ("partial_lead_id");
