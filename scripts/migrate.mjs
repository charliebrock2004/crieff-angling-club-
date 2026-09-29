#!/usr/bin/env node
// Applies supabase/migrations/*.sql (and optionally supabase/seed.sql) to DATABASE_URL.
// Tracks applied files in public._migrations so it is safe to re-run.
//
//   npm run db:migrate            apply pending migrations
//   npm run db:seed               apply migrations + seed (seed only runs on an empty db)
//   npm run db:reset              DROP public schema, re-apply everything (local only!)
//
// On a plain (non-Supabase) Postgres, pass --shim to create a stand-in `auth` schema.
import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const args = new Set(process.argv.slice(2));
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const sql = postgres(url, { max: 1, onnotice: () => {}, prepare: false });

try {
  if (args.has("--reset")) {
    if (/supabase\.(co|com)/.test(url) && !args.has("--i-know")) {
      throw new Error("Refusing to reset a Supabase-hosted database without --i-know");
    }
    await sql.unsafe("drop schema if exists public cascade; create schema public; grant all on schema public to public;");
    console.log("Reset public schema");
  }
  const hasAuth = (await sql`select 1 from pg_namespace where nspname = 'auth'`).length > 0;
  if (!hasAuth || args.has("--shim")) {
    await sql.unsafe(fs.readFileSync(path.join(root, "scripts/test-auth-shim.sql"), "utf8"));
    console.log("Applied local auth shim");
  }
  await sql`create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())`;
  const dir = path.join(root, "supabase/migrations");
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const applied = new Set((await sql`select name from public._migrations`).map((r) => r.name));
  for (const f of files) {
    if (applied.has(f)) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(fs.readFileSync(path.join(dir, f), "utf8"));
      await tx`insert into public._migrations (name) values (${f})`;
    });
    console.log("Applied", f);
  }
  if (args.has("--seed")) {
    const [{ count }] = await sql`select count(*)::int as count from public.waters`;
    if (count > 0) console.log("Seed skipped (data already present)");
    else {
      await sql.unsafe(fs.readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
      console.log("Seeded");
    }
  }
} catch (err) {
  console.error(err.message ?? err);
  process.exitCode = 1;
} finally {
  await sql.end();
}
