import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "../env";

/** Service-role client for Storage uploads and auth administration. Server only. */
export function createSupabaseAdminClient() {
  const url = env.supabaseUrl;
  const key = env.supabaseServiceRoleKey;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
