#!/usr/bin/env node
/**
 * Brings the production database and its migration history in line with
 * prisma/migrations, during the production build. Written to run once
 * (2026-10-05) and then be removed: the standing rule is still that migrations
 * reach production only with explicit approval (CLAUDE.md).
 *
 * The state it repairs: production was built by `db push`, baselined at 0_init,
 * then given migrations by hand — some applied, some not, none reliably recorded
 * in `_prisma_migrations`. For each migration folder, oldest first:
 *
 *   already recorded as applied        → left alone
 *   baseline (0_init, the db-push
 *     catch-up)                        → recorded, NEVER executed: production
 *                                        already has it, and the catch-up holds
 *                                        DROP TABLEs for tables long gone
 *   everything it creates already
 *     exists                           → recorded without executing
 *   otherwise                          → executed and recorded in ONE transaction
 *
 * Every migration it may execute is idempotent (IF NOT EXISTS, guarded
 * constraints). Records match what `prisma migrate resolve` writes (SHA-256 of
 * the file), so `prisma migrate status` reads them normally afterwards.
 *
 * Production builds only (VERCEL_ENV=production). FAILS THE BUILD on any error,
 * so a deployment never goes live against a database it does not match. At the
 * end it prints the remaining difference between production and schema.prisma
 * (informational). Never prints the connection string.
 */
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import prismaPkg from "@prisma/client";

const { PrismaClient, Prisma } = prismaPkg;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = resolve(ROOT, "prisma/migrations");
const BASELINE = new Set(["0_init", "20260901_db_push_catch_up"]);
const tag = "[db-sync]";

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

/**
 * Split a migration into statements. Aware of 'strings', $$dollar quotes$$ (DO
 * blocks carry semicolons) and both comment styles.
 */
function splitSql(sql) {
  const out = [];
  let cur = "";
  let i = 0;
  let dollar = null;
  while (i < sql.length) {
    const c = sql[i];
    const two = sql.slice(i, i + 2);
    if (dollar) {
      if (sql.startsWith(dollar, i)) { cur += dollar; i += dollar.length; dollar = null; } else { cur += c; i++; }
      continue;
    }
    if (two === "--") { const nl = sql.indexOf("\n", i); i = nl === -1 ? sql.length : nl; continue; }
    if (two === "/*") { const end = sql.indexOf("*/", i + 2); i = end === -1 ? sql.length : end + 2; continue; }
    if (c === "'") {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === "'" && sql[j + 1] !== "'")) j += sql[j] === "'" ? 2 : 1;
      cur += sql.slice(i, j + 1); i = j + 1;
      continue;
    }
    if (c === "$") {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (m) { dollar = m[0]; cur += dollar; i += dollar.length; continue; }
    }
    if (c === ";") { if (cur.trim()) out.push(cur.trim()); cur = ""; i++; continue; }
    cur += c; i++;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Does everything this migration creates already exist? Unknown counts as no. */
async function alreadyPresent(sql) {
  const checks = [];
  for (const [, t] of sql.matchAll(/CREATE TABLE IF NOT EXISTS "(\w+)"/g)) checks.push(["relation", t]);
  for (const [, x] of sql.matchAll(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS "(\w+)"/g)) checks.push(["relation", x]);
  for (const [, k] of sql.matchAll(/ADD\s+CONSTRAINT "(\w+)"/g)) checks.push(["constraint", k]);
  for (const [, t, c] of sql.matchAll(/ALTER TABLE "(\w+)" ADD COLUMN IF NOT EXISTS "(\w+)"/g)) checks.push(["column", t, c]);
  for (const [, t, c] of sql.matchAll(/ALTER TABLE "(\w+)"\s+ALTER COLUMN "(\w+)" SET DEFAULT/g)) checks.push(["default", t, c]);
  if (checks.length === 0) return false;

  for (const [kind, a, b] of checks) {
    let ok;
    if (kind === "relation") {
      [{ ok }] = await db.$queryRaw`SELECT to_regclass(${`public."${a}"`}) IS NOT NULL AS ok`;
    } else if (kind === "constraint") {
      // A same-named unique index counts: `db push` sometimes made one of those
      // where the migration makes a constraint, and re-adding would collide.
      [{ ok }] = await db.$queryRaw`
        SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = ${a})
            OR to_regclass(${`public."${a}"`}) IS NOT NULL AS ok`;
    } else if (kind === "column") {
      [{ ok }] = await db.$queryRaw`
        SELECT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ${a} AND column_name = ${b}) AS ok`;
    } else {
      [{ ok }] = await db.$queryRaw`
        SELECT EXISTS (SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = ${a} AND column_name = ${b}
            AND column_default IS NOT NULL) AS ok`;
    }
    if (!ok) return false;
  }
  return true;
}

function record(name, checksum, steps, note) {
  return db.$executeRaw`
    INSERT INTO "_prisma_migrations"
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES (${randomUUID()}, ${checksum}, now(), ${name}, ${note}, NULL, now(), ${steps})`;
}

/** What is still different between production and schema.prisma. Informational. */
function reportDiff() {
  const bin = resolve(ROOT, "node_modules/.bin/prisma");
  const res = spawnSync(bin, ["migrate", "diff", "--from-url", url, "--to-schema-datamodel", "prisma/schema.prisma", "--script"], {
    cwd: ROOT,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL || url, DIRECT_URL: url },
    encoding: "utf8",
  });
  const text = `${res.stdout ?? ""}`.split(url).join("<url>").trim();
  if (res.status !== 0) {
    console.warn(`${tag} could not compute the schema diff (exit ${res.status}):`, `${res.stderr ?? ""}`.split(url).join("<url>").slice(0, 500));
  } else if (!text || /empty migration/.test(text)) {
    console.log(`${tag} production matches schema.prisma exactly`);
  } else {
    const lines = text.split("\n");
    console.log(`${tag} production differs from schema.prisma — ${lines.filter((l) => l.startsWith("-- ")).length} change(s) would be needed:`);
    console.log(lines.slice(0, 120).join("\n"));
  }
}

try {
  // Prisma's own DDL for its history table, as `migrate resolve` creates it.
  await db.$executeRaw`
    CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
      "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
      "checksum"            VARCHAR(64) NOT NULL,
      "finished_at"         TIMESTAMPTZ,
      "migration_name"      VARCHAR(255) NOT NULL,
      "logs"                TEXT,
      "rolled_back_at"      TIMESTAMPTZ,
      "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
      "applied_steps_count" INTEGER NOT NULL DEFAULT 0
    )`;

  const names = readdirSync(MIGRATIONS, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  const tally = { kept: 0, baselined: 0, recorded: 0, applied: 0 };

  for (const name of names) {
    const sql = readFileSync(resolve(MIGRATIONS, name, "migration.sql"), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const rows = await db.$queryRaw`
      SELECT checksum, finished_at, rolled_back_at FROM "_prisma_migrations" WHERE migration_name = ${name}`;
    const done = rows.find((r) => r.finished_at && !r.rolled_back_at);

    if (done) {
      tally.kept++;
      console.log(`${tag} ${name}: already recorded${done.checksum === checksum ? "" : " (file changed since — left as is)"}`);
      continue;
    }
    // A failed earlier attempt blocks `migrate deploy`; retire it the way
    // `migrate resolve --rolled-back` would.
    await db.$executeRaw`
      UPDATE "_prisma_migrations" SET rolled_back_at = now()
      WHERE migration_name = ${name} AND finished_at IS NULL AND rolled_back_at IS NULL`;

    if (BASELINE.has(name)) {
      await record(name, checksum, 0, "db-sync: baseline, recorded without executing");
      tally.baselined++;
      console.log(`${tag} ${name}: recorded as baseline (not executed)`);
    } else if (await alreadyPresent(sql)) {
      await record(name, checksum, 0, "db-sync: already present, recorded without executing");
      tally.recorded++;
      console.log(`${tag} ${name}: already in the database — recorded`);
    } else {
      const statements = splitSql(sql);
      // Prisma.raw: the SQL is a committed migration file, never user input.
      await db.$transaction([
        ...statements.map((s) => db.$executeRaw(Prisma.raw(s))),
        record(name, checksum, 1, "db-sync: executed"),
      ]);
      tally.applied++;
      console.log(`${tag} ${name}: APPLIED (${statements.length} statements) and recorded`);
    }
  }

  console.log(`${tag} done — ${names.length} migrations: ${tally.applied} applied, ${tally.recorded} recorded as present, ${tally.baselined} baselined, ${tally.kept} already recorded`);
  reportDiff();
} catch (error) {
  console.error(`${tag} FAILED —`, `${error instanceof Error ? error.message : error}`.split(url).join("<url>"));
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
