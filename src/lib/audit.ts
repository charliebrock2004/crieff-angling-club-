import "server-only";
import { sql } from "./db";
import type { Viewer } from "./auth";

export async function audit(actor: Viewer | null, action: string, entityType: string, entityId: string | null, details: Record<string, unknown> = {}) {
  try {
    await sql`
      insert into public.audit_logs (actor_id, actor_email, action, entity_type, entity_id, details)
      values (${actor?.id ?? null}, ${actor?.email ?? null}, ${action}, ${entityType}, ${entityId}, ${sql.json(details as never)})`;
  } catch (err) {
    console.error("audit log failed", err);
  }
}
