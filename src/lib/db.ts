import "server-only";
import postgres, { type TransactionSql } from "postgres";
import { env } from "./env";

/**
 * Server-only PostgreSQL connection (Supabase Postgres via the pooler in
 * production). This connection bypasses RLS, so every caller is responsible
 * for authorisation — see lib/auth.ts.
 *
 * - `date` columns are returned as 'YYYY-MM-DD' strings (no timezone drift).
 * - `prepare: false` keeps us compatible with Supabase's transaction pooler.
 */
function createClient() {
  return postgres(env.databaseUrl, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 5),
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

export const sql: Sql = new Proxy(function () {} as unknown as Sql, {
  get(_t, prop) {
    globalForDb.__cacSql ??= createClient();
    const target = globalForDb.__cacSql as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(globalForDb.__cacSql) : value;
  },
  apply(_t, _this, args) {
    globalForDb.__cacSql ??= createClient();
    return (globalForDb.__cacSql as unknown as (...a: unknown[]) => unknown)(...args);
  },
}) as Sql;

export type { Sql };
export type Tx = TransactionSql<{ date: string }>;
/** Anything that can run a query: the pool or an open transaction. */
export type Db = Sql | Tx;

/** Postgres error helpers */
export function pgErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err !== null && "code" in err ? String((err as { code: unknown }).code) : undefined;
}
