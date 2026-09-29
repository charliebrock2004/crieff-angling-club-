import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

/**
 * Creates a throwaway database, applies the real migrations + seed, and
 * returns a client configured exactly like the app's (dates as strings).
 * Requires a local PostgreSQL; set TEST_DATABASE_ADMIN_URL to override.
 */
const ADMIN_URL = process.env.TEST_DATABASE_ADMIN_URL ?? "postgres://postgres@localhost:5432/postgres";

export const hasTestDatabase = async () => {
  const admin = postgres(ADMIN_URL, { max: 1, connect_timeout: 3, onnotice: () => {} });
  try {
    await admin`select 1`;
    return true;
  } catch {
    return false;
  } finally {
    await admin.end({ timeout: 1 });
  }
};

export function makeClient(url: string, max = 10) {
  return postgres(url, {
    max,
    prepare: false,
    onnotice: () => {},
    types: { date: { to: 1082, from: [1082], serialize: (x: string) => x, parse: (x: string) => x } },
  });
}

export async function createTestDatabase(name: string) {
  const root = path.resolve(import.meta.dirname, "../..");
  const admin = postgres(ADMIN_URL, { max: 1, onnotice: () => {} });
  await admin.unsafe(`drop database if exists ${name} with (force)`);
  await admin.unsafe(`create database ${name}`);
  await admin.end();

  const url = ADMIN_URL.replace(/\/[^/]*$/, `/${name}`);
  const setup = makeClient(url, 1);
  await setup.unsafe(fs.readFileSync(path.join(root, "scripts/test-auth-shim.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await setup.unsafe(fs.readFileSync(path.join(dir, f), "utf8"));
  }
  await setup.unsafe(fs.readFileSync(path.join(root, "supabase/seed.sql"), "utf8"));
  await setup.end();
  const sql = makeClient(url);
  process.env.DATABASE_URL = url;
  return { sql, url };
}
