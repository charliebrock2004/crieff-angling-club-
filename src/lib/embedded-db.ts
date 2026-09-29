import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";

/**
 * In-process Postgres used only when DATABASE_URL is not set, so the site can
 * build and be browsed before Supabase is connected. Data is the committed
 * seed and does not survive a new server instance. Never take payment against it.
 */
type Runner = { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[]; affectedRows?: number }> };

type Frag = { __kind: "frag"; strings: readonly string[]; args: unknown[] };
type Ident = { __kind: "ident"; name: string };
type Unsafe = { __kind: "unsafe"; text: string };
type JsonVal = { __kind: "json"; value: unknown };
type List = { __kind: "list"; values: unknown[] };
type Piece = Frag | Ident | Unsafe | JsonVal | List;

const globalForEmbedded = globalThis as unknown as { __cacEmbedded?: Promise<Runner> };

function prep(sql: string): string {
  return sql
    .replace(/create extension if not exists pgcrypto;\s*/gi, "")
    .replace(/create extension if not exists citext;\s*/gi, "")
    .replace(/\bcitext\b/g, "text");
}

async function boot(): Promise<Runner> {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = new PGlite({
    // Match the app's postgres.js date parser: `date` columns stay 'YYYY-MM-DD'.
    parsers: { 1082: (value: string) => value },
  });
  await db.waitReady;
  const root = process.cwd();
  const files = [
    path.join(root, "scripts/test-auth-shim.sql"),
    ...fs
      .readdirSync(path.join(root, "supabase/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()
      .map((f) => path.join(root, "supabase/migrations", f)),
    path.join(root, "supabase/seed.sql"),
  ];
  for (const file of files) await db.exec(prep(fs.readFileSync(file, "utf8")));
  console.info("[crieff] DATABASE_URL is not set — serving seeded fishery data in memory. Bookings are not persisted.");
  return db as unknown as Runner;
}

function runner(): Promise<Runner> {
  globalForEmbedded.__cacEmbedded ??= boot();
  return globalForEmbedded.__cacEmbedded;
}

function quoteIdent(name: string): string {
  return name
    .split(".")
    .map((part) => `"${part.replace(/"/g, '""')}"`)
    .join(".");
}

function isPiece(value: unknown): value is Piece {
  return typeof value === "object" && value !== null && "__kind" in value;
}

function compileArg(value: unknown, params: unknown[]): string {
  if (isPiece(value)) {
    if (value.__kind === "frag") return compile(value, params);
    if (value.__kind === "ident") return quoteIdent(value.name);
    if (value.__kind === "unsafe") return value.text;
    if (value.__kind === "json") {
      params.push(JSON.stringify(value.value ?? null));
      return `$${params.length}::jsonb`;
    }
    if (!value.values.length) return "(null)";
    return `(${value.values.map((v) => compileArg(v, params)).join(",")})`;
  }
  params.push(value === undefined ? null : value);
  return `$${params.length}`;
}

function compile(frag: Frag, params: unknown[]): string {
  let text = "";
  frag.strings.forEach((part, i) => {
    text += part;
    if (i < frag.args.length) text += compileArg(frag.args[i], params);
  });
  return text;
}

function makeSql(db: Runner) {
  async function execute(frag: Frag) {
    const params: unknown[] = [];
    const text = compile(frag, params).trim();
    if (!text) return Object.assign([], { count: 0 });
    const result = await db.query(text, params);
    return Object.assign(result.rows, { count: result.affectedRows ?? result.rows.length });
  }

  function sql(strings: TemplateStringsArray | string | unknown[], ...args: unknown[]) {
    if (strings && Array.isArray((strings as TemplateStringsArray).raw)) {
      const frag: Frag = { __kind: "frag", strings: strings as unknown as readonly string[], args };
      // Execute only when awaited. Nested fragments are interpolated, not run on their own.
      let pending: ReturnType<typeof execute> | undefined;
      return Object.assign(frag, {
        then(onFulfilled?: (rows: Record<string, unknown>[]) => unknown, onRejected?: (err: unknown) => unknown) {
          pending ??= execute(frag);
          return pending.then(onFulfilled, onRejected);
        },
      });
    }
    if (typeof strings === "string" && args.length === 0) return { __kind: "ident", name: strings };
    if (Array.isArray(strings)) return { __kind: "list", values: strings };
    return { __kind: "frag", strings: [""], args: [] };
  }

  sql.unsafe = (text: string) => ({ __kind: "unsafe" as const, text });
  sql.json = (value: unknown) => ({ __kind: "json" as const, value });
  sql.begin = async (a: unknown, b?: unknown) => {
    const fn = (typeof a === "function" ? a : b) as (tx: typeof sql) => Promise<unknown>;
    const live = await runner();
    const transaction = (live as unknown as PGlite).transaction;
    if (typeof transaction === "function") {
      return transaction.call(live, async (tx: Runner) => fn(makeSql(tx) as typeof sql));
    }
    await live.query("begin");
    try {
      const result = await fn(sql);
      await live.query("commit");
      return result;
    } catch (err) {
      await live.query("rollback");
      throw err;
    }
  };
  return sql;
}

/** Tagged-template client compatible with the queries in this app. */
export async function createEphemeralSql() {
  return makeSql(await runner());
}
