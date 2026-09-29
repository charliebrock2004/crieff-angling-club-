import "server-only";
import postgres, { type TransactionSql } from "postgres";
import { createEphemeralSql } from "./embedded-db";

/**
 * Server-only PostgreSQL connection (Supabase Postgres via the pooler in
 * production). This connection bypasses RLS, so every caller is responsible
 * for authorisation — see lib/auth.ts.
 *
 * When DATABASE_URL is missing, an in-process seeded database is used so the
 * public site and availability calendar still render. That database is not
 * durable — do not take payment against it (`isEphemeralDatabase`).
 *
 * - `date` columns are returned as 'YYYY-MM-DD' strings (no timezone drift).
 * - `prepare: false` keeps us compatible with Supabase's transaction pooler.
 */
const configuredUrl = process.env["DATABASE_URL"]?.trim() || "";

/** True when the process is not connected to the club's real database. */
export const isEphemeralDatabase = configuredUrl === "" && process.env["VITEST"] !== "true";

export const databaseNotReadyMessage =
  "This can't be saved yet. The club database is not connected, so nothing would be kept and you have not been charged.";

function createClient(url: string) {
  return postgres(url, {
    max: Number(process.env["DATABASE_POOL_MAX"] ?? 5),
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    onnotice: () => {},
    types: {
      date: {
        to: 1082,
        from: [1082],
        serialize: (x: string) => x,
        parse: (x: string) => x,
      },
    },
  });
}

type Sql = ReturnType<typeof createClient>;
const globalForDb = globalThis as unknown as { __cacSql?: Sql };

function postgresSql(url: string): Sql {
  return new Proxy(function () {} as unknown as Sql, {
    get(_t, prop) {
      globalForDb.__cacSql ??= createClient(url);
      const target = globalForDb.__cacSql as unknown as Record<string | symbol, unknown>;
      const value = target[prop];
      return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(globalForDb.__cacSql) : value;
    },
    apply(_t, _this, args) {
      globalForDb.__cacSql ??= createClient(url);
      return (globalForDb.__cacSql as unknown as (...a: unknown[]) => unknown)(...args);
    },
  }) as Sql;
}

export const sql: Sql = configuredUrl
  ? postgresSql(configuredUrl)
  : process.env["VITEST"] === "true"
    ? postgresSql("postgres://postgres@127.0.0.1:9/unused")
    : ((await createEphemeralSql()) as unknown as Sql);

export type { Sql };
export type Tx = TransactionSql<{ date: string }>;
/** Anything that can run a query: the pool or an open transaction. */
export type Db = Sql | Tx;

/** Postgres error helpers */
export function pgErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}
