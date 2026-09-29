import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, hasTestDatabase } from "./support/db";
import { checkoutInput, fakeNotifier, fakeStripe, ids, isTroutWeekday, nextDate, requiredRuleIds } from "./support/fixtures";
import type { Sql } from "@/lib/db";
import { addDays, clubToday } from "@/lib/dates";

const available = await hasTestDatabase();
const d = available ? describe : describe.skip;
let sql: Sql;
let I: Record<string, string>;
let ACK: string[];

beforeAll(async () => {
  if (!available) return;
  ({ sql } = (await createTestDatabase("crieff_test_security")) as { sql: Sql });
  I = await ids(sql);
  ACK = await requiredRuleIds(sql);
  // Mirror Supabase's default grants so RLS is what actually protects data.
  await sql.unsafe(`grant usage on schema public to anon, authenticated; grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
});
afterAll(async () => {
  if (available) await sql.end();
});

/** Run a query as a Supabase API role (optionally as a signed-in user). */
async function asRole<T>(role: "anon" | "authenticated", userId: string | null, fn: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx.unsafe(`set local role ${role}`);
    if (userId) await tx`select set_config('request.jwt.claim.sub', ${userId}, true)`;
    return fn(tx as unknown as Sql);
  }) as Promise<T>;
}

d("row level security (public anon key)", () => {
  it("anon can read published content only", async () => {
    await sql`update public.news_posts set status = 'draft' where slug = 'welcome-to-the-new-website'`;
    const [waters, news, rules] = await asRole("anon", null, async (tx) => [await tx`select slug from public.waters`, await tx`select slug from public.news_posts`, await tx`select id from public.rules`]);
    expect(waters.length).toBe(2);
    expect(news.length).toBe(0);
    expect(rules.length).toBeGreaterThan(0);
    await sql`update public.news_posts set status = 'published' where slug = 'welcome-to-the-new-website'`;
  });

  it("anon cannot read bookings, customers, payments, permits or audit logs", async () => {
    const svc = await import("@/lib/booking/service");
    await svc.createPendingBooking(sql, checkoutInput({ date: nextDate(isTroutWeekday), beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK));
    const counts = await asRole("anon", null, async (tx) => {
      const out: Record<string, number> = {};
      for (const t of ["bookings", "customers", "payments", "permits", "audit_logs", "membership_applications", "contact_messages", "profiles", "stripe_events"]) {
        out[t] = (await tx.unsafe(`select count(*)::int as n from public.${t}`))[0].n;
      }
      return out;
    });
    expect(Object.values(counts).every((n) => n === 0)).toBe(true);
  });

  it("anon cannot write anything", async () => {
    await expect(asRole("anon", null, (tx) => tx`insert into public.news_posts (slug, title) values ('x', 'x')`)).rejects.toThrow(/row-level security/);
    const updated = await asRole("anon", null, (tx) => tx`update public.permit_prices set price_pence = 1 returning id`);
    expect(updated.length).toBe(0);
  });

  it("a signed-in angler sees only their own bookings and cannot change their role", async () => {
    const [u] = await sql`insert into auth.users (email, email_confirmed_at) values ('owner@example.com', now()) returning id`;
    const [other] = await sql`insert into auth.users (email, email_confirmed_at) values ('other@example.com', now()) returning id`;
    const svc = await import("@/lib/booking/service");
    const date = nextDate(isTroutWeekday);
    const mine = await svc.createPendingBooking(sql, { ...checkoutInput({ date, beatId: I["upper-strowan"], permitTypeId: I["brown-trout-river"] }, ACK), contact: { ...checkoutInput({ date, beatId: "", permitTypeId: "" }).contact, email: "owner@example.com" } }, { userId: u.id, userEmail: "owner@example.com" });
    const seen = await asRole("authenticated", u.id, (tx) => tx`select id from public.bookings`);
    expect(seen.map((r) => r.id)).toEqual([mine.id]);
    const seenByOther = await asRole("authenticated", other.id, (tx) => tx`select id from public.bookings`);
    expect(seenByOther).toHaveLength(0);
    const changed = await asRole("authenticated", u.id, (tx) => tx`update public.profiles set role = 'admin' where id = ${u.id} returning id`);
    expect(changed).toHaveLength(0);
    const [p] = await sql`select role from public.profiles where id = ${u.id}`;
    expect(p.role).toBe("angler");
  });

  it("customer records are only linked to a login after email confirmation", async () => {
    const svc = await import("@/lib/booking/service");
    const date = nextDate(isTroutWeekday);
    const base = checkoutInput({ date, beatId: I["drummond-castle"], permitTypeId: I["brown-trout-river"] }, ACK);
    await svc.createPendingBooking(sql, { ...base, contact: { ...base.contact, email: "victim@example.com" } });
    const [attacker] = await sql`insert into auth.users (email) values ('victim@example.com') returning id`;
    const [c1] = await sql`select user_id from public.customers where email = 'victim@example.com'`;
    expect(c1.user_id).toBeNull();
    await sql`update auth.users set email_confirmed_at = now() where id = ${attacker.id}`;
    const [c2] = await sql`select user_id from public.customers where email = 'victim@example.com'`;
    expect(c2.user_id).toBe(attacker.id);
  });

  it("admins get full access through RLS", async () => {
    const [a] = await sql`insert into auth.users (email, email_confirmed_at) values ('boss@example.com', now()) returning id`;
    await sql`update public.profiles set role = 'admin' where id = ${a.id}`;
    const n = await asRole("authenticated", a.id, (tx) => tx`select count(*)::int as n from public.bookings`);
    expect(n[0].n).toBeGreaterThan(0);
  });
});

d("permit verification", () => {
  it("reports each state and hides personal details from the public", async () => {
    const svc = await import("@/lib/booking/service");
    const { verifyPermit } = await import("@/lib/permits/data");
    const date = nextDate(isTroutWeekday);
    const b = await svc.createPendingBooking(sql, checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK));
    const [p] = await sql`select verification_code from public.permits where booking_id = ${b.id}`;
    expect((await verifyPermit(sql, p.verification_code, { staff: false })).result).toBe("unpaid");
    await svc.markBookingPaid(sql, b.id, { sessionId: null, paymentIntentId: "pi_v", amountTotal: 700 });
    const pub = await verifyPermit(sql, p.verification_code, { staff: false, today: date });
    expect(pub.result).toBe("valid");
    expect(pub.anglerName).toBe("A. Test0");
    expect(pub.bookingReference).toBeNull();
    const staff = await verifyPermit(sql, p.verification_code.toLowerCase(), { staff: true, today: date });
    expect(staff.anglerName).toBe("Angus Test0");
    expect(staff.bookingReference).toBe(b.reference);
    expect((await verifyPermit(sql, p.verification_code, { staff: false, today: "2000-01-01" })).result).toBe("valid_other_day");
    expect((await verifyPermit(sql, p.verification_code, { staff: false, today: "2999-01-01" })).result).toBe("expired");
    await svc.cancelBooking(sql, b.id, { reason: "x" });
    expect((await verifyPermit(sql, p.verification_code, { staff: false, today: date })).result).toBe("cancelled");
    expect((await verifyPermit(sql, "NOPE' OR 1=1 --", { staff: false })).result).toBe("not_found");
  });

  it("customer permit links require the secret token", async () => {
    const svc = await import("@/lib/booking/service");
    const { loadBookingForCustomer } = await import("@/lib/permits/data");
    const b = await svc.createPendingBooking(sql, checkoutInput({ date: nextDate(isTroutWeekday), beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK));
    expect(await loadBookingForCustomer(sql, b.reference, b.accessToken)).not.toBeNull();
    expect(await loadBookingForCustomer(sql, b.reference, "wrong-token-wrong-token-wrong-token")).toBeNull();
    expect(await loadBookingForCustomer(sql, b.reference, null)).toBeNull();
  });

  it("generates a permit PDF with one page per angler", async () => {
    const svc = await import("@/lib/booking/service");
    const { loadBooking } = await import("@/lib/permits/data");
    const { permitPdf } = await import("@/lib/permits/pdf");
    const { PDFDocument } = await import("pdf-lib");
    const b = await svc.createPendingBooking(sql, checkoutInput({ date: nextDate(isTroutWeekday, addDays(clubToday(), 120)), beatId: I["upper-strowan"], permitTypeId: I["brown-trout-river"], quantity: 3 }, ACK));
    await svc.markBookingPaid(sql, b.id, { sessionId: null, paymentIntentId: null, amountTotal: null });
    const detail = (await loadBooking(sql, { id: b.id }))!;
    const bytes = await permitPdf(detail, "https://example.test", ["Fly only — no bank fishing “quoted”"]);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(3);
  });
});

d("membership payments via webhook", () => {
  it("activates a membership once, whatever the number of deliveries", async () => {
    const { markMembershipPaid, startMembershipCheckout } = await import("@/lib/membership/service");
    const { processStripeEvent } = await import("@/lib/booking/webhook");
    const [t] = await sql`select id from public.membership_types where slug = 'country'`;
    const [a] = await sql`insert into public.membership_applications (reference, access_token, membership_type_id, first_name, last_name, email, address_line1, town, postcode, status)
      values ('MEM-TEST01', ${"t".repeat(40)}, ${t.id}, 'Iain', 'Test', 'iain@example.com', '1 St', 'Crieff', 'PH7 3AA', 'submitted') returning id`;
    const { stripe } = fakeStripe();
    await expect(startMembershipCheckout(sql, a.id, { stripe, siteUrl: "https://x.test" })).rejects.toMatchObject({ code: "invalid_state" });
    await sql`update public.membership_applications set status = 'offered' where id = ${a.id}`;
    const url = await startMembershipCheckout(sql, a.id, { stripe, siteUrl: "https://x.test" });
    expect(url).toContain("checkout.stripe.test");
    const [p] = await sql`select stripe_checkout_session_id as sid, amount_pence from public.payments where membership_application_id = ${a.id}`;
    expect(p.amount_pence).toBe(21000);
    const n = fakeNotifier();
    const ev = { id: "evt_m1", type: "checkout.session.completed", data: { object: { id: p.sid, payment_status: "paid", payment_intent: "pi_m", amount_total: 21000, metadata: { kind: "membership", application_id: a.id } } } } as never;
    await processStripeEvent(sql, ev, n);
    await processStripeEvent(sql, ev, n);
    await markMembershipPaid(sql, a.id, { sessionId: p.sid, paymentIntentId: "pi_m", amountTotal: 21000 }, n);
    const ms = await sql`select status, amount_paid_pence from public.memberships where application_id = ${a.id}`;
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ status: "active", amount_paid_pence: 21000 });
    expect(n.calls.filter((c) => c.type === "membership")).toHaveLength(1);
  });
});

d("rate limiter", () => {
  it("allows up to the limit per window", async () => {
    const results = [];
    for (let i = 0; i < 5; i++) results.push((await sql`select public.hit_rate_limit('test:1', 3, 60) as ok`)[0].ok);
    expect(results).toEqual([true, true, true, false, false]);
  });
});
