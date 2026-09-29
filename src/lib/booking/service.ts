/**
 * Booking lifecycle: hold → pay → confirm, plus cancellation and refunds.
 *
 *   createPendingBooking   validates everything server-side and inserts a
 *                          `pending` booking inside a transaction that holds
 *                          the beat/day advisory lock. The DB trigger is a
 *                          second, independent guard against overbooking.
 *   startCheckout          creates the Stripe Checkout Session for it.
 *   markBookingPaid        idempotent; called from the webhook *and* the
 *                          success page, whichever runs first.
 *   expire/cancel/refund   state transitions, all idempotent.
 *
 * External services are passed in (`deps`) so the logic is testable.
 */
import type Stripe from "stripe";
import { pgErrorCode, type Sql, type Tx } from "../db";
import { accessToken, bookingReference, verificationCode } from "../ids";
import type { CheckoutInput } from "../validation";
import { evaluate, REASON_MESSAGES, rulesForBooking } from "./engine";
import { loadBookingConfig, loadUsage } from "./config";
import type { UnavailableReason } from "./types";

export type BookingErrorCode =
  | UnavailableReason
  | "not_found"
  | "invalid"
  | "insufficient_availability"
  | "rules_not_acknowledged"
  | "junior_not_confirmed"
  | "payments_unavailable"
  | "payment_error"
  | "invalid_state";

export class BookingError extends Error {
  constructor(
    public code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export interface Notifier {
  bookingConfirmed(bookingId: string): Promise<void>;
  bookingCancelled(bookingId: string): Promise<void>;
  bookingRefunded(bookingId: string): Promise<void>;
  membershipPaid(applicationId: string): Promise<void>;
  needsAttention(subject: string, message: string): Promise<void>;
}

export type StripeLike = Pick<Stripe, "checkout" | "refunds">;

export interface CreatedBooking {
  id: string;
  reference: string;
  accessToken: string;
  totalPence: number;
  unitPricePence: number;
  boatFeePence: number;
  quantity: number;
  holdExpiresAt: Date;
  description: string;
  customerEmail: string;
}

interface CreateOptions {
  userId?: string | null;
  userEmail?: string | null;
  now?: Date;
  source?: "online" | "admin" | "phone" | "in_person";
  /** Admin: mark paid immediately (cash / cheque / complimentary) */
  markPaidMethod?: string | null;
  /** Admin: bypass capacity (recorded on the booking) */
  capacityOverride?: boolean;
  /** Admin: ignore lead-time / same-day rules */
  ignoreBookingWindow?: boolean;
  adminNotes?: string | null;
  createdBy?: string | null;
  /** Admin may override the price (pence per permit) */
  unitPriceOverridePence?: number | null;
}

async function upsertCustomer(tx: Tx, c: CheckoutInput["contact"], userId: string | null): Promise<string> {
  // Only fill blanks on an existing record: an unauthenticated checkout must
  // never be able to overwrite someone else's stored details by using their
  // email address. The booking keeps its own snapshot in `contact`.
  const [row] = await tx`
    insert into public.customers (user_id, first_name, last_name, email, phone, address_line1, address_line2, town, postcode)
    values (${userId}, ${c.firstName}, ${c.lastName}, ${c.email}, ${c.phone}, ${c.addressLine1}, ${c.addressLine2 || null}, ${c.town}, ${c.postcode})
    on conflict (email) do update set
      user_id = coalesce(public.customers.user_id, excluded.user_id),
      phone = coalesce(public.customers.phone, excluded.phone),
      address_line1 = coalesce(public.customers.address_line1, excluded.address_line1),
      address_line2 = coalesce(public.customers.address_line2, excluded.address_line2),
      town = coalesce(public.customers.town, excluded.town),
      postcode = coalesce(public.customers.postcode, excluded.postcode)
    returning id`;
  return row.id;
}

export async function createPendingBooking(db: Sql, input: CheckoutInput, opts: CreateOptions = {}): Promise<CreatedBooking> {
  const cfg = await loadBookingConfig(db);
  const permit = cfg.permitTypes.find((p) => p.id === input.permitTypeId);
  const beat = cfg.beats.find((b) => b.id === input.beatId);
  if (!permit || !beat) throw new BookingError("not_found", "That permit or beat no longer exists.");
  if (beat.waterId !== permit.waterId) throw new BookingError("not_on_beat", REASON_MESSAGES.not_on_beat);
  const water = cfg.waters.find((w) => w.id === permit.waterId)!;

  const isAdmin = opts.source && opts.source !== "online";
  if (!isAdmin) {
    // Relevant rules that need acknowledging must all have been ticked.
    const rules = await db`
      select id, category, water_id, beat_id, species_id, show_at_booking, requires_acknowledgement
      from public.rules where is_published and show_at_booking and requires_acknowledgement`;
    const required = rulesForBooking(
      rules.map((r) => ({
        id: r.id as string,
        category: r.category as string,
        waterId: r.water_id as string | null,
        beatId: r.beat_id as string | null,
        speciesId: r.species_id as string | null,
        showAtBooking: r.show_at_booking as boolean,
        requiresAcknowledgement: r.requires_acknowledgement as boolean,
      })),
      { waterId: water.id, beatId: beat.id, speciesIds: permit.speciesIds, requiresBoat: permit.requiresBoat },
    );
    const acked = new Set(input.acknowledgedRuleIds);
    if (required.some((r) => !acked.has(r.id))) {
      throw new BookingError("rules_not_acknowledged", "Please read and accept the rules for this permit.");
    }
    if (permit.isJunior && !input.juniorConfirmed) {
      throw new BookingError("junior_not_confirmed", "Please confirm every angler on this booking qualifies for a junior permit.");
    }
  }
  if (input.anglers.length !== input.quantity) throw new BookingError("invalid", "Enter a name for each angler.");

  const now = opts.now ?? new Date();
  // Hold = Stripe session lifetime + a grace period, so a payment completed in
  // the last second of checkout is always still covered by the hold.
  const holdExpiresAt = new Date(now.getTime() + (cfg.settings.holdMinutes + 6) * 60_000);
  const userId = opts.userId && opts.userEmail && opts.userEmail.toLowerCase() === input.contact.email ? opts.userId : null;

  const attempt = async (): Promise<CreatedBooking> =>
    db.begin(async (tx) => {
      await tx`select public.lock_beat_day(${beat.id}, ${input.date})`;
      if (permit.requiresBoat) await tx`select public.release_expired_boat_holds(${water.id}, ${input.date})`;

      const usage = await loadUsage(tx, input.date, input.date);
      const a = evaluate(cfg, usage, permit, beat, input.date, { now, ignoreBookingWindow: opts.ignoreBookingWindow });
      if (!a.sellable && !(opts.capacityOverride && (a.reason === "full" || a.reason === "no_boats" || a.reason === "blocked"))) {
        throw new BookingError(a.reason ?? "invalid", a.message ?? "Not available.");
      }
      if (!opts.capacityOverride && input.quantity > a.maxQuantity) {
        throw new BookingError(
          "insufficient_availability",
          a.maxQuantity > 0 ? `Only ${a.maxQuantity} permit${a.maxQuantity === 1 ? "" : "s"} left for this date.` : "Fully booked.",
        );
      }
      if (input.quantity > permit.maxPerBooking && !isAdmin) {
        throw new BookingError("invalid", `A maximum of ${permit.maxPerBooking} permits can be booked at once.`);
      }

      let boatId: string | null = null;
      let boatFee = 0;
      if (permit.requiresBoat) {
        const [boat] = await tx`
          select bt.id, bt.hire_price_pence from public.boats bt
          where bt.water_id = ${water.id} and bt.is_active and bt.capacity_anglers >= ${input.quantity}
            and not exists (
              select 1 from public.boat_bookings bb
              where bb.boat_id = bt.id and bb.fishing_date = ${input.date} and bb.released_at is null)
          order by bt.capacity_anglers, bt.hire_price_pence, bt.sort_order
          limit 1`;
        if (!boat) throw new BookingError("no_boats", REASON_MESSAGES.no_boats);
        boatId = boat.id;
        boatFee = boat.hire_price_pence;
      }

      const unit = opts.unitPriceOverridePence ?? a.price?.pricePence ?? 0;
      const total = unit * input.quantity + boatFee;
      const customerId = await upsertCustomer(tx, input.contact, userId);
      const reference = bookingReference();
      const token = accessToken();
      const paidNow = !!opts.markPaidMethod;

      const [booking] = await tx`
        insert into public.bookings (
          reference, access_token, customer_id, contact, water_id, beat_id, permit_type_id, permit_price_id,
          fishing_date, quantity, unit_price_pence, boat_fee_pence, total_pence, status, source,
          hold_expires_at, capacity_override, rules_acknowledged_at, rules_acknowledged, paid_at, admin_notes, created_by)
        values (
          ${reference}, ${token}, ${customerId}, ${tx.json(input.contact)}, ${water.id}, ${beat.id}, ${permit.id}, ${a.price?.id ?? null},
          ${input.date}, ${input.quantity}, ${unit}, ${boatFee}, ${total}, ${paidNow ? "paid" : "pending"}, ${opts.source ?? "online"},
          ${paidNow ? null : holdExpiresAt}, ${!!opts.capacityOverride}, ${isAdmin ? null : now}, ${tx.json(input.acknowledgedRuleIds)},
          ${paidNow ? now : null}, ${opts.adminNotes ?? null}, ${opts.createdBy ?? null})
        returning id`;

      if (boatId) {
        await tx`insert into public.boat_bookings (boat_id, booking_id, fishing_date, anglers) values (${boatId}, ${booking.id}, ${input.date}, ${input.quantity})`;
      }
      for (const angler of input.anglers) {
        await tx`
          insert into public.permits (booking_id, permit_number, verification_code, angler_first_name, angler_last_name)
          values (${booking.id}, 'P' || nextval('public.permit_number_seq')::text, ${verificationCode()}, ${angler.firstName}, ${angler.lastName})`;
      }
      await tx`
        insert into public.payments (kind, booking_id, amount_pence, status, method)
        values ('booking', ${booking.id}, ${total}, ${paidNow ? "succeeded" : "pending"}, ${paidNow ? opts.markPaidMethod! : "stripe"})`;

      return {
        id: booking.id,
        reference,
        accessToken: token,
        totalPence: total,
        unitPricePence: unit,
        boatFeePence: boatFee,
        quantity: input.quantity,
        holdExpiresAt,
        description: `${permit.name} · ${beat.name === water.name ? water.name : `${water.name}, ${beat.name}`}`,
        customerEmail: input.contact.email,
      };
    });

  try {
    return await attempt();
  } catch (err) {
    if (err instanceof BookingError) throw err;
    const code = pgErrorCode(err);
    if (code === "CA001" || code === "CA002") throw new BookingError("full", "Sorry — those permits have just been taken. Please choose another date or beat.");
    if (code === "23505" && String((err as Error).message).includes("boat_bookings_one_per_day")) {
      throw new BookingError("no_boats", REASON_MESSAGES.no_boats);
    }
    if (code === "23505" && String((err as Error).message).includes("reference")) return attempt(); // reference collision: retry once
    throw err;
  }
}

export interface CheckoutDeps {
  stripe: StripeLike | null;
  siteUrl: string;
}

/** Create a held booking and a Stripe Checkout Session for it. */
export async function startCheckout(
  db: Sql,
  input: CheckoutInput,
  deps: CheckoutDeps,
  opts: { userId?: string | null; userEmail?: string | null; now?: Date } = {},
): Promise<{ url: string; bookingId: string; reference: string }> {
  if (!deps.stripe) throw new BookingError("payments_unavailable", "Online payment is not available at the moment. Please contact the club to book.");
  const booking = await createPendingBooking(db, input, opts);
  const [{ fishing_date: fishingDate }] = await db`select fishing_date from public.bookings where id = ${booking.id}`;
  const stripeExpiry = Math.floor(booking.holdExpiresAt.getTime() / 1000) - 5 * 60;

  try {
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        quantity: booking.quantity,
        price_data: {
          currency: "gbp",
          unit_amount: booking.unitPricePence,
          product_data: { name: booking.description, description: `Fishing date: ${fishingDate} · Ref ${booking.reference}` },
        },
      },
    ];
    if (booking.boatFeePence > 0) {
      lineItems.push({ quantity: 1, price_data: { currency: "gbp", unit_amount: booking.boatFeePence, product_data: { name: "Boat hire" } } });
    }
    const session = await deps.stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: booking.customerEmail,
        client_reference_id: booking.id,
        line_items: lineItems,
        expires_at: stripeExpiry,
        payment_intent_data: { metadata: { kind: "booking", booking_id: booking.id, reference: booking.reference } },
        metadata: { kind: "booking", booking_id: booking.id, reference: booking.reference },
        success_url: `${deps.siteUrl}/book/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${deps.siteUrl}/book/cancelled?ref=${encodeURIComponent(booking.reference)}&t=${encodeURIComponent(booking.accessToken)}`,
      },
      { idempotencyKey: `booking-checkout-${booking.id}` },
    );
    await db`update public.payments set stripe_checkout_session_id = ${session.id} where booking_id = ${booking.id} and kind = 'booking'`;
    if (!session.url) throw new Error("Stripe did not return a checkout URL");
    return { url: session.url, bookingId: booking.id, reference: booking.reference };
  } catch (err) {
    await db`update public.bookings set status = 'failed', cancellation_reason = 'checkout_session_error' where id = ${booking.id} and status = 'pending'`;
    await db`update public.payments set status = 'failed', failure_message = ${String((err as Error).message).slice(0, 500)} where booking_id = ${booking.id}`;
    throw new BookingError("payment_error", "We couldn't start the payment. Nothing has been charged — please try again.");
  }
}

export interface PaidResult {
  changed: boolean;
  status: string;
  needsAttention: string | null;
}

/** Idempotently mark a booking paid after Stripe confirms payment. */
export async function markBookingPaid(
  db: Sql,
  bookingId: string,
  payment: { sessionId: string | null; paymentIntentId: string | null; amountTotal: number | null },
  notifier?: Notifier,
): Promise<PaidResult> {
  const result = await db.begin(async (tx): Promise<PaidResult> => {
    const [b] = await tx`select id, status, total_pence, reference from public.bookings where id = ${bookingId} for update`;
    if (!b) throw new BookingError("not_found", "Booking not found");

    await tx`
      update public.payments set status = 'succeeded',
        stripe_payment_intent_id = coalesce(${payment.paymentIntentId}, stripe_payment_intent_id),
        stripe_checkout_session_id = coalesce(stripe_checkout_session_id, ${payment.sessionId})
      where booking_id = ${bookingId} and kind = 'booking' and status in ('pending', 'failed', 'cancelled')`;

    if (b.status === "paid" || b.status === "refunded") return { changed: false, status: b.status, needsAttention: null };

    let attention: string | null = null;
    if (payment.amountTotal !== null && payment.amountTotal !== b.total_pence) {
      attention = `Amount paid (${payment.amountTotal}p) differs from booking total (${b.total_pence}p).`;
    }

    if (b.status === "pending") {
      await tx`update public.bookings set status = 'paid', paid_at = now(), needs_attention = ${attention} where id = ${bookingId}`;
      return { changed: true, status: "paid", needsAttention: attention };
    }

    // Payment arrived for a booking that was cancelled/failed meanwhile. Try to
    // reinstate it; if the beat has since filled, flag it for a refund.
    try {
      await tx.savepoint(async (sp) => {
        await sp`update public.bookings set status = 'paid', paid_at = now(), cancelled_at = null, cancellation_reason = null, needs_attention = ${attention} where id = ${bookingId}`;
      });
      return { changed: true, status: "paid", needsAttention: attention };
    } catch (err) {
      const code = pgErrorCode(err);
      if (code !== "CA001" && code !== "CA002") throw err;
      const msg = `Payment received for booking ${b.reference} after it was ${b.status}, and the beat is now full. Refund required.`;
      await tx`update public.bookings set needs_attention = ${msg} where id = ${bookingId}`;
      return { changed: false, status: b.status, needsAttention: msg };
    }
  });

  if (notifier) {
    if (result.changed) await notifier.bookingConfirmed(bookingId);
    if (result.needsAttention) await notifier.needsAttention("Booking needs attention", result.needsAttention);
  }
  return result;
}

/** Checkout expired or abandoned: release the hold. */
export async function releaseBooking(db: Sql, bookingId: string, reason: "checkout_expired" | "checkout_cancelled" | "payment_failed"): Promise<boolean> {
  const status = reason === "payment_failed" ? "failed" : "cancelled";
  const rows = await db`
    update public.bookings set status = ${status}, cancelled_at = now(), cancellation_reason = ${reason}
    where id = ${bookingId} and status = 'pending'
    returning id`;
  if (rows.length) {
    await db`update public.payments set status = ${status === "failed" ? "failed" : "cancelled"} where booking_id = ${bookingId} and status = 'pending'`;
  }
  return rows.length > 0;
}

/** Admin cancellation (optionally followed by a refund). */
export async function cancelBooking(
  db: Sql,
  bookingId: string,
  opts: { reason: string; actorId?: string | null },
  notifier?: Notifier,
): Promise<void> {
  const rows = await db`
    update public.bookings set status = 'cancelled', cancelled_at = now(), cancellation_reason = ${opts.reason}
    where id = ${bookingId} and status in ('pending', 'paid')
    returning id`;
  if (!rows.length) {
    const [b] = await db`select status from public.bookings where id = ${bookingId}`;
    if (!b) throw new BookingError("not_found", "Booking not found");
    throw new BookingError("invalid_state", `This booking is already ${b.status}.`);
  }
  await db`update public.payments set status = 'cancelled' where booking_id = ${bookingId} and status = 'pending'`;
  if (notifier) await notifier.bookingCancelled(bookingId);
}

/**
 * Record a refund total for a booking's payment (absolute amount, so it is
 * idempotent whether it comes from our own API call or a webhook).
 */
export async function applyRefundTotal(
  db: Sql,
  where: { bookingId?: string; paymentIntentId?: string },
  totalRefundedPence: number,
  notifier?: Notifier,
): Promise<{ bookingId: string; fullyRefunded: boolean } | null> {
  const result = await db.begin(async (tx) => {
    const [p] = where.bookingId
      ? await tx`select * from public.payments where booking_id = ${where.bookingId} and kind = 'booking' for update`
      : await tx`select * from public.payments where stripe_payment_intent_id = ${where.paymentIntentId!} for update`;
    if (!p || p.kind !== "booking") return null;
    const amount = Math.min(totalRefundedPence, p.amount_pence);
    if (amount <= p.amount_refunded_pence) {
      const [b] = await tx`select status from public.bookings where id = ${p.booking_id}`;
      return { bookingId: p.booking_id as string, fullyRefunded: b.status === "refunded", changed: false };
    }
    const full = amount >= p.amount_pence;
    await tx`update public.payments set amount_refunded_pence = ${amount}, status = ${full ? "refunded" : "partially_refunded"} where id = ${p.id}`;
    await tx`
      update public.bookings set amount_refunded_pence = ${amount},
        status = case when ${full} then 'refunded'::public.booking_status else status end,
        refunded_at = case when ${full} then now() else refunded_at end
      where id = ${p.booking_id}`;
    return { bookingId: p.booking_id as string, fullyRefunded: full, changed: true };
  });
  if (result?.changed && notifier) await notifier.bookingRefunded(result.bookingId);
  return result ? { bookingId: result.bookingId, fullyRefunded: result.fullyRefunded } : null;
}

/** Admin refund through Stripe. `amountPence` omitted = refund the balance. */
export async function refundBooking(
  db: Sql,
  stripe: StripeLike | null,
  bookingId: string,
  opts: { amountPence?: number | null; reason?: string | null },
  notifier?: Notifier,
): Promise<{ refundedPence: number; fullyRefunded: boolean }> {
  const [p] = await db`select * from public.payments where booking_id = ${bookingId} and kind = 'booking'`;
  if (!p) throw new BookingError("not_found", "No payment found for this booking.");
  if (p.status !== "succeeded" && p.status !== "partially_refunded") {
    throw new BookingError("invalid_state", "Only paid bookings can be refunded.");
  }
  const balance = p.amount_pence - p.amount_refunded_pence;
  const amount = opts.amountPence ?? balance;
  if (!Number.isInteger(amount) || amount <= 0 || amount > balance) {
    throw new BookingError("invalid", `Refund must be between 1p and ${balance}p.`);
  }

  let newTotal = p.amount_refunded_pence + amount;
  if (p.method === "stripe") {
    if (!stripe) throw new BookingError("payments_unavailable", "Stripe is not configured, so this refund cannot be processed online.");
    if (!p.stripe_payment_intent_id) throw new BookingError("invalid_state", "This payment has no Stripe payment reference.");
    const refund = await stripe.refunds.create(
      { payment_intent: p.stripe_payment_intent_id, amount, reason: "requested_by_customer", metadata: { booking_id: bookingId, note: (opts.reason ?? "").slice(0, 400) } },
      { idempotencyKey: `refund-${bookingId}-${p.amount_refunded_pence}-${amount}` },
    );
    if (refund.status === "failed" || refund.status === "canceled") {
      throw new BookingError("payment_error", "Stripe could not process the refund.");
    }
  } else {
    // Cash / manual payments: record the refund only.
    newTotal = p.amount_refunded_pence + amount;
  }
  const r = await applyRefundTotal(db, { bookingId }, newTotal, notifier);
  return { refundedPence: amount, fullyRefunded: r?.fullyRefunded ?? false };
}

/** Claim a one-off notification slot. Returns true exactly once. */
export async function claimNotification(
  db: Sql,
  bookingId: string,
  column: "confirmation_sent_at" | "admin_notified_at" | "cancellation_notified_at" | "refund_notified_at",
): Promise<boolean> {
  const rows = await db`
    update public.bookings set ${db(column)} = now()
    where id = ${bookingId} and ${db(column)} is null
    returning id`;
  return rows.length > 0;
}

export async function releaseNotificationClaim(
  db: Sql,
  bookingId: string,
  column: "confirmation_sent_at" | "admin_notified_at" | "cancellation_notified_at" | "refund_notified_at",
) {
  await db`update public.bookings set ${db(column)} = null where id = ${bookingId}`;
}
