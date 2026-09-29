import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, hasTestDatabase, makeClient } from "./support/db";
import { checkoutInput, fakeNotifier, fakeStripe, ids, isTroutWeekday, nextDate, requiredRuleIds } from "./support/fixtures";
import type { Sql } from "@/lib/db";

const available = await hasTestDatabase();
const d = available ? describe : describe.skip;

let sql: Sql;
let url: string;
let I: Record<string, string>;
let ACK: string[];
let svc: typeof import("@/lib/booking/service");
let webhook: typeof import("@/lib/booking/webhook");

beforeAll(async () => {
  if (!available) return;
  ({ sql, url } = (await createTestDatabase("crieff_test_booking")) as { sql: Sql; url: string });
  I = await ids(sql);
  ACK = await requiredRuleIds(sql);
  svc = await import("@/lib/booking/service");
  webhook = await import("@/lib/booking/webhook");
});
afterAll(async () => {
  if (available) await sql.end();
});

const troutDay = () => nextDate(isTroutWeekday);
let dayCursor = 0;
/** A fresh trout weekday per test so tests don't share capacity. */
function freshDay() {
  let d = troutDay();
  for (let i = 0; i <= dayCursor; i++) d = nextDate(isTroutWeekday, i === 0 ? d : nextDateAfter(d));
  dayCursor++;
  return d;
}
function nextDateAfter(d: string) {
  const x = new Date(`${d}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + 1);
  return x.toISOString().slice(0, 10);
}

d("createPendingBooking", () => {
  it("creates a held booking with permits and a pending payment", async () => {
    const date = freshDay();
    const b = await svc.createPendingBooking(sql, checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"], quantity: 2 }, ACK));
    expect(b.reference).toMatch(/^CAC-[A-Z0-9]{6}$/);
    expect(b.totalPence).toBe(1400);
    const [row] = await sql`select status, hold_expires_at from public.bookings where id = ${b.id}`;
    expect(row.status).toBe("pending");
    expect(new Date(row.hold_expires_at).getTime()).toBeGreaterThan(Date.now() + 30 * 60_000);
    const permits = await sql`select verification_code from public.permits where booking_id = ${b.id}`;
    expect(permits).toHaveLength(2);
    expect(permits[0].verification_code).toMatch(/^[A-Z0-9]{14}$/);
    const [p] = await sql`select status, amount_pence from public.payments where booking_id = ${b.id}`;
    expect(p).toMatchObject({ status: "pending", amount_pence: 1400 });
  });

  it("uses the server price, not anything from the client", async () => {
    const date = freshDay();
    const input = { ...checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK), unitPricePence: 1 } as never;
    const b = await svc.createPendingBooking(sql, input);
    expect(b.unitPricePence).toBe(700);
  });

  it("requires the relevant rules to be acknowledged", async () => {
    const date = freshDay();
    await expect(
      svc.createPendingBooking(sql, checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, [])),
    ).rejects.toMatchObject({ code: "rules_not_acknowledged" });
  });

  it("requires junior confirmation for junior permits", async () => {
    const date = freshDay();
    await expect(
      svc.createPendingBooking(sql, checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river-junior"] }, ACK)),
    ).rejects.toMatchObject({ code: "junior_not_confirmed" });
    const ok = await svc.createPendingBooking(sql, checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river-junior"], juniorConfirmed: true }, ACK));
    expect(ok.totalPence).toBe(300);
  });

  it("refuses grayling permits outside Drummond Castle", async () => {
    const date = nextDate((x) => x.slice(5, 7) === "12");
    await expect(
      svc.createPendingBooking(sql, checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["grayling"] }, ACK)),
    ).rejects.toMatchObject({ code: "not_on_beat" });
  });

  it("refuses Sunday salmon permits", async () => {
    const date = nextDate((x) => new Date(`${x}T00:00:00Z`).getUTCDay() === 0 && x.slice(5, 7) >= "03" && x.slice(5, 7) <= "07");
    await expect(
      svc.createPendingBooking(sql, checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["salmon-sea-trout"] }, ACK)),
    ).rejects.toMatchObject({ code: "closed_weekday" });
  });

  it("prevents overbooking sequentially", async () => {
    const date = freshDay();
    const base = { date, beatId: I["upper-strowan"], permitTypeId: I["brown-trout-river"] };
    await svc.createPendingBooking(sql, checkoutInput({ ...base, quantity: 3 }, ACK));
    await expect(svc.createPendingBooking(sql, checkoutInput({ ...base, quantity: 2 }, ACK))).rejects.toMatchObject({
      code: "insufficient_availability",
      message: "Only 1 permit left for this date.",
    });
    await svc.createPendingBooking(sql, checkoutInput({ ...base, quantity: 1 }, ACK));
    await expect(svc.createPendingBooking(sql, checkoutInput(base, ACK))).rejects.toMatchObject({ code: "full" });
  });

  it("prevents overbooking under concurrent checkouts", async () => {
    const date = freshDay();
    const pool = makeClient(url, 20) as unknown as Sql;
    try {
      const attempts = await Promise.allSettled(
        Array.from({ length: 16 }, () =>
          svc.createPendingBooking(pool, checkoutInput({ date, beatId: I["drummond-castle"], permitTypeId: I["brown-trout-river"] }, ACK)),
        ),
      );
      const ok = attempts.filter((a) => a.status === "fulfilled");
      expect(ok).toHaveLength(4);
      const [{ total }] = await sql`
        select sum(quantity)::int as total from public.bookings
        where beat_id = ${I["drummond-castle"]} and fishing_date = ${date} and public.booking_is_active(status, hold_expires_at)`;
      expect(total).toBe(4);
    } finally {
      await pool.end();
    }
  });

  it("the database itself rejects overbooking even if app checks are bypassed", async () => {
    const date = freshDay();
    const b = await svc.createPendingBooking(sql, checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"], quantity: 4 }, ACK));
    const [row] = await sql`select * from public.bookings where id = ${b.id}`;
    await expect(sql`
      insert into public.bookings (reference, access_token, customer_id, water_id, beat_id, permit_type_id, fishing_date, quantity, unit_price_pence, total_pence, status, hold_expires_at)
      values ('CAC-RAW001', ${"x".repeat(40)}, ${row.customer_id}, ${row.water_id}, ${row.beat_id}, ${row.permit_type_id}, ${date}, 1, 700, 700, 'pending', now() + interval '1 hour')`).rejects.toMatchObject({ code: "CA001" });
  });

  it("frees capacity when a hold expires", async () => {
    const date = freshDay();
    const base = { date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"], quantity: 4 };
    const first = await svc.createPendingBooking(sql, checkoutInput(base, ACK));
    await expect(svc.createPendingBooking(sql, checkoutInput({ ...base, quantity: 1 }, ACK))).rejects.toBeTruthy();
    await sql`update public.bookings set hold_expires_at = now() - interval '1 minute' where id = ${first.id}`;
    const second = await svc.createPendingBooking(sql, checkoutInput(base, ACK));
    expect(second.id).toBeTruthy();
  });

  it("respects blocked dates", async () => {
    const date = freshDay();
    await sql`insert into public.availability_overrides (beat_id, start_date, end_date, is_blocked, public_note) values (${I["braidhaugh"]}, ${date}, ${date}, true, 'Club competition')`;
    await expect(
      svc.createPendingBooking(sql, checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK)),
    ).rejects.toMatchObject({ code: "blocked", message: "Club competition" });
  });

  it("allocates one boat per loch booking and never double-books a boat", async () => {
    const date = freshDay();
    const base = { date, beatId: I["drummond-loch"], permitTypeId: I["drummond-loch-boat"] };
    await expect(svc.createPendingBooking(sql, checkoutInput({ ...base, quantity: 4 }, ACK))).rejects.toBeTruthy();
    const made = [];
    for (let i = 0; i < 3; i++) made.push(await svc.createPendingBooking(sql, checkoutInput({ ...base, quantity: 1 }, ACK)));
    await expect(svc.createPendingBooking(sql, checkoutInput({ ...base, quantity: 1 }, ACK))).rejects.toMatchObject({ code: "no_boats" });
    const boats = await sql`select boat_id from public.boat_bookings where fishing_date = ${date} and released_at is null`;
    expect(new Set(boats.map((b) => b.boat_id)).size).toBe(3);
    // Cancelling releases the boat
    await svc.releaseBooking(sql, made[0].id, "checkout_cancelled");
    const again = await svc.createPendingBooking(sql, checkoutInput({ ...base, quantity: 2 }, ACK));
    expect(again.id).toBeTruthy();
  });

  it("does not overwrite an existing customer's details from a guest checkout", async () => {
    const date = freshDay();
    const input = checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK);
    await svc.createPendingBooking(sql, input);
    const attacker = { ...input, contact: { ...input.contact, firstName: "Mallory", phone: "07000 000000" } };
    await svc.createPendingBooking(sql, attacker);
    const [c] = await sql`select first_name, phone from public.customers where email = ${input.contact.email}`;
    expect(c).toMatchObject({ first_name: "Angus", phone: "07700 900123" });
  });
});

d("checkout, webhooks and refunds", () => {
  const sessionEvent = (id: string, type: string, session: Record<string, unknown>) => ({ id, type, data: { object: session } }) as never;

  it("creates a Stripe checkout session for the held booking", async () => {
    const { stripe, sessions } = fakeStripe();
    const date = freshDay();
    const res = await svc.startCheckout(sql, checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"], quantity: 2 }, ACK), { stripe, siteUrl: "https://example.test" });
    expect(res.url).toContain("checkout.stripe.test");
    const s = sessions[0] as { line_items: { quantity: number; price_data: { unit_amount: number } }[]; metadata: Record<string, string>; expires_at: number };
    expect(s.line_items[0]).toMatchObject({ quantity: 2, price_data: { unit_amount: 700 } });
    expect(s.metadata).toMatchObject({ kind: "booking", booking_id: res.bookingId });
    expect(s.expires_at * 1000).toBeGreaterThanOrEqual(Date.now() + 30 * 60_000);
    const [p] = await sql`select stripe_checkout_session_id from public.payments where booking_id = ${res.bookingId}`;
    expect(p.stripe_checkout_session_id).toMatch(/^cs_test_/);
  });

  it("releases the hold if Stripe fails", async () => {
    const { stripe } = fakeStripe({ failCreate: true });
    const date = freshDay();
    const input = checkoutInput({ date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"], quantity: 4 }, ACK);
    await expect(svc.startCheckout(sql, input, { stripe, siteUrl: "https://x.test" })).rejects.toMatchObject({ code: "payment_error" });
    const again = await svc.createPendingBooking(sql, input);
    expect(again.id).toBeTruthy();
  });

  it("refuses to take payment when Stripe is not configured", async () => {
    await expect(
      svc.startCheckout(sql, checkoutInput({ date: freshDay(), beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK), { stripe: null, siteUrl: "" }),
    ).rejects.toMatchObject({ code: "payments_unavailable" });
  });

  it("confirms payment exactly once across duplicate and overlapping webhooks", async () => {
    const { stripe } = fakeStripe();
    const n = fakeNotifier();
    const res = await svc.startCheckout(sql, checkoutInput({ date: freshDay(), beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK), { stripe, siteUrl: "https://x.test" });
    const [p] = await sql`select stripe_checkout_session_id as sid from public.payments where booking_id = ${res.bookingId}`;
    const session = { id: p.sid, payment_status: "paid", payment_intent: "pi_123", amount_total: 700, metadata: { kind: "booking", booking_id: res.bookingId } };

    expect(await webhook.processStripeEvent(sql, sessionEvent("evt_1", "checkout.session.completed", session), n)).toBe("processed");
    expect(await webhook.processStripeEvent(sql, sessionEvent("evt_1", "checkout.session.completed", session), n)).toBe("duplicate");
    // A different event for the same session (e.g. success page + webhook) must not re-confirm
    expect(await webhook.processStripeEvent(sql, sessionEvent("evt_2", "checkout.session.async_payment_succeeded", session), n)).toBe("processed");
    await Promise.all([
      webhook.fulfilCheckoutSession(sql, session as never, n),
      webhook.fulfilCheckoutSession(sql, session as never, n),
    ]);

    expect(n.calls.filter((c) => c.type === "confirmed")).toHaveLength(1);
    const [b] = await sql`select status, paid_at from public.bookings where id = ${res.bookingId}`;
    expect(b.status).toBe("paid");
    const [pay] = await sql`select status, stripe_payment_intent_id from public.payments where booking_id = ${res.bookingId}`;
    expect(pay).toMatchObject({ status: "succeeded", stripe_payment_intent_id: "pi_123" });
  });

  it("does not confirm an unpaid session", async () => {
    const res = await svc.createPendingBooking(sql, checkoutInput({ date: freshDay(), beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK));
    await webhook.processStripeEvent(sql, sessionEvent("evt_unpaid", "checkout.session.completed", { id: "cs_x", payment_status: "unpaid", metadata: { kind: "booking", booking_id: res.id } }));
    const [b] = await sql`select status from public.bookings where id = ${res.id}`;
    expect(b.status).toBe("pending");
  });

  it("expired checkout cancels the booking and frees capacity; failed payment marks it failed", async () => {
    const date = freshDay();
    const base = { date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"], quantity: 4 };
    const a = await svc.createPendingBooking(sql, checkoutInput(base, ACK));
    await webhook.processStripeEvent(sql, sessionEvent("evt_exp_1", "checkout.session.expired", { id: "cs_e1", metadata: { kind: "booking", booking_id: a.id } }));
    const [ra] = await sql`select status, cancellation_reason from public.bookings where id = ${a.id}`;
    expect(ra).toMatchObject({ status: "cancelled", cancellation_reason: "checkout_expired" });

    const b = await svc.createPendingBooking(sql, checkoutInput(base, ACK));
    await webhook.processStripeEvent(sql, { id: "evt_pf", type: "payment_intent.payment_failed", data: { object: { id: "pi_f", last_payment_error: { message: "Your card was declined." }, metadata: { kind: "booking", booking_id: b.id } } } } as never);
    const [still] = await sql`select status from public.bookings where id = ${b.id}`;
    expect(still.status).toBe("pending"); // customer can retry within checkout
    await webhook.processStripeEvent(sql, sessionEvent("evt_exp_2", "checkout.session.expired", { id: "cs_e2", metadata: { kind: "booking", booking_id: b.id } }));
    const [rb] = await sql`select status from public.bookings where id = ${b.id}`;
    expect(rb.status).toBe("failed");
    const [pb] = await sql`select status, failure_message from public.payments where booking_id = ${b.id}`;
    expect(pb).toMatchObject({ status: "failed", failure_message: "Your card was declined." });
  });

  it("flags a payment that lands after the booking was cancelled and the beat filled", async () => {
    const date = freshDay();
    const n = fakeNotifier();
    const base = { date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"], quantity: 4 };
    const a = await svc.createPendingBooking(sql, checkoutInput(base, ACK));
    await svc.releaseBooking(sql, a.id, "checkout_expired");
    await svc.createPendingBooking(sql, checkoutInput(base, ACK));
    const r = await svc.markBookingPaid(sql, a.id, { sessionId: "cs_late", paymentIntentId: "pi_late", amountTotal: 2800 }, n);
    expect(r.changed).toBe(false);
    expect(r.needsAttention).toMatch(/Refund required/);
    expect(n.calls.map((c) => c.type)).toEqual(["attention"]);
  });

  it("refunds in full and partially, idempotently with the webhook", async () => {
    const { stripe, refunds } = fakeStripe();
    const n = fakeNotifier();
    const res = await svc.createPendingBooking(sql, checkoutInput({ date: freshDay(), beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"], quantity: 2 }, ACK));
    await svc.markBookingPaid(sql, res.id, { sessionId: "cs_r", paymentIntentId: "pi_refund", amountTotal: 1400 });

    const part = await svc.refundBooking(sql, stripe, res.id, { amountPence: 700 }, n);
    expect(part).toEqual({ refundedPence: 700, fullyRefunded: false });
    let [b] = await sql`select status, amount_refunded_pence from public.bookings where id = ${res.id}`;
    expect(b).toMatchObject({ status: "paid", amount_refunded_pence: 700 });

    await expect(svc.refundBooking(sql, stripe, res.id, { amountPence: 800 }, n)).rejects.toMatchObject({ code: "invalid" });
    const full = await svc.refundBooking(sql, stripe, res.id, {}, n);
    expect(full).toEqual({ refundedPence: 700, fullyRefunded: true });
    [b] = await sql`select status, refunded_at from public.bookings where id = ${res.id}`;
    expect(b.status).toBe("refunded");
    expect(refunds.map((r) => r.amount)).toEqual([700, 700]);

    // Stripe then sends charge.refunded with the cumulative amount: no change, no extra email.
    await webhook.processStripeEvent(sql, { id: "evt_ref", type: "charge.refunded", data: { object: { payment_intent: "pi_refund", amount_refunded: 1400 } } } as never, n);
    expect(n.calls.filter((c) => c.type === "refunded")).toHaveLength(2);
    await expect(svc.refundBooking(sql, stripe, res.id, {}, n)).rejects.toMatchObject({ code: "invalid_state" });
  });

  it("applies refunds made in the Stripe dashboard via webhook", async () => {
    const n = fakeNotifier();
    const res = await svc.createPendingBooking(sql, checkoutInput({ date: freshDay(), beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK));
    await svc.markBookingPaid(sql, res.id, { sessionId: "cs_d", paymentIntentId: "pi_dash", amountTotal: 700 });
    await webhook.processStripeEvent(sql, { id: "evt_dash", type: "charge.refunded", data: { object: { payment_intent: "pi_dash", amount_refunded: 700 } } } as never, n);
    const [b] = await sql`select status from public.bookings where id = ${res.id}`;
    expect(b.status).toBe("refunded");
    expect(n.calls).toEqual([{ type: "refunded", id: res.id }]);
  });

  it("cancels once and refuses to cancel twice", async () => {
    const n = fakeNotifier();
    const res = await svc.createPendingBooking(sql, checkoutInput({ date: freshDay(), beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK));
    await svc.markBookingPaid(sql, res.id, { sessionId: null, paymentIntentId: "pi_c", amountTotal: 700 });
    await svc.cancelBooking(sql, res.id, { reason: "Angler unwell" }, n);
    await expect(svc.cancelBooking(sql, res.id, { reason: "again" }, n)).rejects.toMatchObject({ code: "invalid_state" });
    expect(n.calls).toEqual([{ type: "cancelled", id: res.id }]);
  });

  it("claims notifications exactly once", async () => {
    const res = await svc.createPendingBooking(sql, checkoutInput({ date: freshDay(), beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"] }, ACK));
    const claims = await Promise.all(Array.from({ length: 5 }, () => svc.claimNotification(sql, res.id, "confirmation_sent_at")));
    expect(claims.filter(Boolean)).toHaveLength(1);
  });
});

d("admin manual bookings", () => {
  it("can mark paid immediately and can override capacity explicitly", async () => {
    const date = freshDay();
    const base = { date, beatId: I["braidhaugh"], permitTypeId: I["brown-trout-river"], quantity: 4 };
    const a = await svc.createPendingBooking(sql, checkoutInput(base), { source: "admin", markPaidMethod: "cash" });
    const [ra] = await sql`select status, source from public.bookings where id = ${a.id}`;
    expect(ra).toMatchObject({ status: "paid", source: "admin" });
    await expect(svc.createPendingBooking(sql, checkoutInput({ ...base, quantity: 1 }), { source: "admin", markPaidMethod: "cash" })).rejects.toMatchObject({ code: "full" });
    const over = await svc.createPendingBooking(sql, checkoutInput({ ...base, quantity: 1 }), { source: "admin", markPaidMethod: "cash", capacityOverride: true });
    const [ro] = await sql`select capacity_override from public.bookings where id = ${over.id}`;
    expect(ro.capacity_override).toBe(true);
  });
});
