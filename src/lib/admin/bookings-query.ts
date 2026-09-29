import "server-only";
import { sql } from "../db";
import { isIsoDate } from "../dates";

export interface BookingFilters {
  q?: string;
  status?: string;
  water?: string;
  beat?: string;
  permit?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: string;
  attention?: string;
  page?: number;
  customer?: string;
}

const SORTS: Record<string, string> = { date: "b.fishing_date", created: "b.created_at", amount: "b.total_pence", ref: "b.reference", customer: "lower(b.contact->>'lastName')" };
const STATUSES = ["pending", "paid", "failed", "cancelled", "refunded"];
const UUID = /^[0-9a-f-]{36}$/i;

export function readFilters(sp: Record<string, string | string[] | undefined>): BookingFilters {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  return { q: s("q"), status: s("status"), water: s("water"), beat: s("beat"), permit: s("permit"), from: s("from"), to: s("to"), sort: s("sort"), dir: s("dir"), attention: s("attention"), page: Math.max(1, Number(s("page") ?? 1) || 1), customer: s("customer") };
}

export async function queryBookings(f: BookingFilters, limit = 50) {
  const conds = [sql`true`];
  if (f.q?.trim()) {
    const like = `%${f.q.trim().replace(/[%_]/g, "")}%`;
    conds.push(sql`(b.reference ilike ${like} or b.contact->>'email' ilike ${like} or (b.contact->>'firstName') || ' ' || (b.contact->>'lastName') ilike ${like}
      or exists (select 1 from public.permits pm where pm.booking_id = b.id and (pm.angler_first_name || ' ' || pm.angler_last_name ilike ${like} or pm.permit_number ilike ${like})))`);
  }
  if (f.status && STATUSES.includes(f.status)) conds.push(sql`b.status = ${f.status}`);
  else if (!f.status) conds.push(sql`not (b.status in ('cancelled', 'failed') and b.paid_at is null)`);
  if (f.water && UUID.test(f.water)) conds.push(sql`b.water_id = ${f.water}`);
  if (f.beat && UUID.test(f.beat)) conds.push(sql`b.beat_id = ${f.beat}`);
  if (f.permit && UUID.test(f.permit)) conds.push(sql`b.permit_type_id = ${f.permit}`);
  if (f.customer && UUID.test(f.customer)) conds.push(sql`b.customer_id = ${f.customer}`);
  if (f.from && isIsoDate(f.from)) conds.push(sql`b.fishing_date >= ${f.from}`);
  if (f.to && isIsoDate(f.to)) conds.push(sql`b.fishing_date <= ${f.to}`);
  if (f.attention) conds.push(sql`b.needs_attention is not null`);
  const where = conds.reduce((a, c) => sql`${a} and ${c}`);
  const order = SORTS[f.sort ?? ""] ?? "b.created_at";
  const dir = f.dir === "asc" ? "asc" : "desc";
  const offset = ((f.page ?? 1) - 1) * limit;
  const [rows, [{ total }]] = await Promise.all([
    sql`select b.id, b.reference, b.fishing_date, b.quantity, b.total_pence, b.amount_refunded_pence, b.status, b.source, b.created_at, b.contact, b.needs_attention,
          w.name as water, bt.name as beat, p.name as permit, pay.status as payment_status, pay.method as payment_method
        from public.bookings b
        join public.waters w on w.id = b.water_id join public.beats bt on bt.id = b.beat_id join public.permit_types p on p.id = b.permit_type_id
        left join lateral (select status, method from public.payments where booking_id = b.id order by created_at desc limit 1) pay on true
        where ${where}
        order by ${sql.unsafe(`${order} ${dir}, b.created_at desc`)}
        limit ${limit} offset ${offset}`,
    sql`select count(*)::int as total from public.bookings b where ${where}`,
  ]);
  return { rows, total };
}
