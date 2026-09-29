import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { safeEqual } from "@/lib/ids";

export const dynamic = "force-dynamic";

/**
 * Daily housekeeping (Vercel Cron, see vercel.json). Availability never
 * depends on this — expired holds stop counting immediately — it just keeps
 * the records tidy:
 *   - pending bookings whose hold expired > 1 hour ago become "cancelled"
 *   - memberships past their expiry date become "expired"
 *   - old rate-limit rows are purged
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const expired = await sql`
    update public.bookings set status = 'cancelled', cancelled_at = now(), cancellation_reason = 'checkout_expired'
    where status = 'pending' and hold_expires_at < now() - interval '1 hour' returning id`;
  if (expired.length) {
    await sql`update public.payments set status = 'cancelled' where status = 'pending' and booking_id in ${sql(expired.map((r) => r.id))}`;
  }
  const lapsed = await sql`update public.memberships set status = 'expired' where status = 'active' and expires_on < current_date returning id`;
  await sql`delete from public.rate_limits where window_start < now() - interval '1 day'`;
  return NextResponse.json({ expiredHolds: expired.length, lapsedMemberships: lapsed.length });
}
