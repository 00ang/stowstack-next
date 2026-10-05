-- client_goals (portal monthly move-in goals, /api/client-goals) is in
-- schema.prisma and in the db-push catch-up, but production never got it: the
-- post-sync diff of 2026-10-05 showed it as the one table the schema expects
-- and production lacks. Every /api/client-goals request has been failing.
--
-- PURELY ADDITIVE and idempotent. DDL is what `prisma migrate diff` reported
-- for production against schema.prisma, plus IF NOT EXISTS / a guarded FK. On
-- a database built from migrations the catch-up already created it, so this is
-- a no-op there.

CREATE TABLE IF NOT EXISTS "client_goals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "period_month" DATE NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 0,
    "actual" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_goals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "idx_client_goals_client" ON "client_goals"("client_id", "period_month" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_client_goal_month" ON "client_goals"("client_id", "period_month");

DO $$ BEGIN
  ALTER TABLE "client_goals" ADD CONSTRAINT "client_goals_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
