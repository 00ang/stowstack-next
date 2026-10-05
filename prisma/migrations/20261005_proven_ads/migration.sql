-- Proven Ads library — self-storage ads tracked over time, plus the lineage
-- column that ties an Ad Studio draft back to the proven ad it was adapted from.
-- PURELY ADDITIVE. Two new tables, one nullable column, indexes. Touches no
-- existing rows.
--
-- proven_ads          one row per observed ad (source, source_ad_id)
-- proven_ad_searches  configured discovery searches the refresh job iterates
-- ad_variations       + source_proven_ad_id (nullable, SET NULL on delete)

CREATE TABLE IF NOT EXISTS "proven_ads" (
  "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- meta_ad_library_api | manual | csv_import
  "source"              VARCHAR(32) NOT NULL,
  "source_ad_id"        VARCHAR(128) NOT NULL,
  -- meta | google | tiktok
  "platform"            VARCHAR(16) NOT NULL,
  "publisher_platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "advertiser_name"     VARCHAR(200) NOT NULL,
  "advertiser_page_id"  VARCHAR(64),
  "advertiser_url"      VARCHAR(2000),
  -- image | video | carousel | text | unknown
  "format"              VARCHAR(16) NOT NULL DEFAULT 'unknown',
  "headline"            VARCHAR(500),
  "primary_text"        TEXT,
  "description"         VARCHAR(1000),
  "cta"                 VARCHAR(64),
  "landing_url"         VARCHAR(2000),
  -- A reference to where the ad can be viewed at the source. Never a copy.
  "snapshot_url"        VARCHAR(2000),
  "media_refs"          JSONB,
  "country"             VARCHAR(2),
  "state"               VARCHAR(8),
  "city"                VARCHAR(120),
  "offer_type"          VARCHAR(32),
  "unit_type"           VARCHAR(32),
  "angle"               VARCHAR(32),
  -- The advertiser's delivery start. Days running is derived from this at
  -- read time, never stored.
  "started_at"          DATE NOT NULL,
  "first_seen_at"       TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "last_seen_at"        TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "ended_at"            TIMESTAMPTZ(6),
  "active"              BOOLEAN NOT NULL DEFAULT true,
  "raw"                 JSONB,
  "notes"               TEXT,
  "created_by"          VARCHAR(120),
  "created_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"          TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

-- A CONSTRAINT rather than a bare index so it matches Prisma's @@unique and
-- so the refresh job's upsert has something to conflict on.
ALTER TABLE "proven_ads" DROP CONSTRAINT IF EXISTS "proven_ads_source_ad";
ALTER TABLE "proven_ads" ADD  CONSTRAINT "proven_ads_source_ad" UNIQUE ("source","source_ad_id");

CREATE INDEX IF NOT EXISTS "idx_proven_ads_platform_active" ON "proven_ads" ("platform","active");
CREATE INDEX IF NOT EXISTS "idx_proven_ads_started"         ON "proven_ads" ("started_at");
CREATE INDEX IF NOT EXISTS "idx_proven_ads_state"           ON "proven_ads" ("state");
CREATE INDEX IF NOT EXISTS "idx_proven_ads_offer"           ON "proven_ads" ("offer_type");
CREATE INDEX IF NOT EXISTS "idx_proven_ads_last_seen"       ON "proven_ads" ("last_seen_at");

CREATE TABLE IF NOT EXISTS "proven_ad_searches" (
  "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "adapter"     VARCHAR(32) NOT NULL,
  "label"       VARCHAR(120) NOT NULL,
  "config"      JSONB NOT NULL DEFAULT '{}'::jsonb,
  "enabled"     BOOLEAN NOT NULL DEFAULT true,
  "last_run_at" TIMESTAMPTZ(6),
  "last_result" JSONB,
  "created_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  "updated_at"  TIMESTAMPTZ(6) NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_proven_ad_searches_adapter" ON "proven_ad_searches" ("adapter","enabled");

ALTER TABLE "ad_variations" ADD COLUMN IF NOT EXISTS "source_proven_ad_id" UUID;

DO $$ BEGIN
  ALTER TABLE "ad_variations" ADD CONSTRAINT "ad_variations_source_proven_ad_id_fkey"
    FOREIGN KEY ("source_proven_ad_id") REFERENCES "proven_ads"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "idx_variations_proven_source" ON "ad_variations" ("source_proven_ad_id");
