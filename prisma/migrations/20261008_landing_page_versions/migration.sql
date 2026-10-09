-- Landing page versions.
-- PURELY ADDITIVE. A nullable snapshot on landing_pages, and a versions
-- table. Draft edits stay in landing_page_sections. The public page serves
-- published_snapshot once a page has been published through this path, so
-- editing a live page does not change it until it is published again.
-- Pages published before this migration have a null snapshot and keep
-- serving their sections, as they do today.

ALTER TABLE "landing_pages" ADD COLUMN IF NOT EXISTS "published_snapshot" JSONB;

CREATE TABLE IF NOT EXISTS "landing_page_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "landing_page_id" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "landing_page_versions_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "landing_page_versions"
    ADD CONSTRAINT "landing_page_versions_landing_page_id_fkey"
    FOREIGN KEY ("landing_page_id") REFERENCES "landing_pages"("id")
    ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "landing_page_versions_page_version"
  ON "landing_page_versions" ("landing_page_id", "version");

CREATE INDEX IF NOT EXISTS "idx_lp_versions_page"
  ON "landing_page_versions" ("landing_page_id");
