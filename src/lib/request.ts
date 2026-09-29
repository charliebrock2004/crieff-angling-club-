import "server-only";
import { headers } from "next/headers";
import { sql } from "./db";
import { env } from "./env";
import { hashIp } from "./ids";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  return (fwd ? fwd.split(",")[0].trim() : h.get("x-real-ip")) || null;
}

export async function ipHash(): Promise<string | null> {
  return hashIp(await clientIp(), env.ipHashSalt);
}

/**
 * Database-backed fixed-window rate limit (works across serverless instances).
 * Returns true when the request may proceed.
 */
export async function rateLimit(bucket: string, limit: number, windowSeconds: number): Promise<boolean> {
  const id = (await ipHash()) ?? "unknown";
  try {
    const [row] = await sql`select public.hit_rate_limit(${`${bucket}:${id}`}, ${limit}, ${windowSeconds}) as ok`;
    return row.ok as boolean;
  } catch (err) {
    console.error("rate limit check failed", err);
    return true; // fail open: never block legitimate bookings because of the limiter
  }
}
