#!/usr/bin/env node
/**
 * Applies prisma/migrations/20261005_restore_drifted_tables to the production
 * database during the production build.
 *
 * Why at build time: the migration had to go out the same day and nobody with
 * direct database access was available. The Vercel build already holds the
 * production credentials, so this runs it there without anyone handling them.
 *
 * - Production builds only (VERCEL_ENV=production). Previews and local builds
 *   skip it.
 * - Checks first. Once the three tables and two columns exist it does nothing,
 *   so it is harmless to leave in place and safe to delete once deployed.
 * - Applies the migration's statements in one transaction, then verifies.
 * - FAILS THE BUILD if it cannot connect, apply or verify. A failed build never
 *   goes live, and that matters: schema.prisma declares
 *   clients.report_enabled / report_frequency, and a deployment that declared
 *   them without the columns existing would break every db.clients query.
 *
 * Never prints the connection string.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import prismaPkg from "@prisma/client";

const { PrismaClient, Prisma } = prismaPkg;
const MIGRATION = "20261005_restore_drifted_tables";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tag = `[apply-db-migration] ${MIGRATION}:`;

if (process.env.VERCEL_ENV !== "production") {
  console.log(`${tag} skipped (not a production build)`);
  process.exit(0);
}

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!url) {
  console.error(`${tag} FAILED — no DIRECT_URL or DATABASE_URL in the build environment`);
  process.exit(1);
}

const db = new PrismaClient({ datasourceUrl: url });

async function applied() {
  const [r] = await db.$queryRaw`
    SELECT to_regclass('public.alert_history') IS NOT NULL          AS alert_history,
           to_regclass('public.page_interactions') IS NOT NULL      AS page_interactions,
           to_regclass('public.page_interaction_stats') IS NOT NULL AS page_interaction_stats,
           (SELECT count(*)::int FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'clients'
               AND column_name IN ('report_enabled', 'report_frequency')) AS client_columns
  `;
  return r.alert_history && r.page_interactions && r.page_interaction_stats && r.client_columns === 2;
}

/** The migration's statements. Its comments are whole lines and contain no SQL. */
function statements() {
  const sql = readFileSync(resolve(ROOT, "prisma/migrations", MIGRATION, "migration.sql"), "utf8");
  return sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

try {
  if (await applied()) {
    console.log(`${tag} already applied, nothing to do`);
  } else {
    const stmts = statements();
    // Prisma.raw: the SQL is the committed migration file, never user input.
    await db.$transaction(stmts.map((s) => db.$executeRaw(Prisma.raw(s))));
    if (!(await applied())) throw new Error("statements ran but the tables/columns are still missing");
    console.log(`${tag} applied (${stmts.length} statements) and verified`);
  }
} catch (error) {
  console.error(`${tag} FAILED —`, error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
