-- Proven Ads — the read on each ad, and the facts that make it filterable.
-- PURELY ADDITIVE. Six nullable / defaulted columns and two indexes on
-- proven_ads. Touches no existing values.
--
-- insight           what the ad is, why it has kept running, how an operator
--                   runs their own version (structured; written by the
--                   proven-ads.insights job, never by hand)
-- insight_at        when that read was written
-- family_size       how many live ads share this creative (one per location
--                   for a multi-site operator); a scale signal, not a metric
-- audience          movers | declutterers | vehicle_owners | businesses |
--                   students | military | general
-- advertiser_scale  national | regional | independent
-- study_value       our editorial read on how much an operator can take from
--                   the ad: 3 a transferable structure, 2 solid, 1 a bare
--                   presence ad. Orders the library; never shown as a score.

ALTER TABLE "proven_ads" ADD COLUMN IF NOT EXISTS "insight"          JSONB;
ALTER TABLE "proven_ads" ADD COLUMN IF NOT EXISTS "insight_at"       TIMESTAMPTZ(6);
ALTER TABLE "proven_ads" ADD COLUMN IF NOT EXISTS "family_size"      INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "proven_ads" ADD COLUMN IF NOT EXISTS "audience"         VARCHAR(32);
ALTER TABLE "proven_ads" ADD COLUMN IF NOT EXISTS "advertiser_scale" VARCHAR(16);
ALTER TABLE "proven_ads" ADD COLUMN IF NOT EXISTS "study_value"      SMALLINT;

CREATE INDEX IF NOT EXISTS "idx_proven_ads_audience" ON "proven_ads" ("audience");
CREATE INDEX IF NOT EXISTS "idx_proven_ads_scale"    ON "proven_ads" ("advertiser_scale");
