/**
 * Stripe webhook processing. Every event id is recorded in `stripe_events`;
 * an event that has already been processed successfully is skipped, and every
 * handler is idempotent in its own right, so retries and duplicate deliveries
 * are always safe.
 */
import type Stripe from "stripe";
import type { Sql } from "../db";
import { applyRefundTotal, markBookingPaid, releaseBooking, type Notifier } from "./service";
import { markMembershipPaid } from "../membership/service";

export type WebhookOutcome = "processed" | "duplicate" | "ignored";

function intentId(v: string | Stripe.PaymentIntent | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id;
}

export async function fulfilCheckoutSession(db: Sql, session: Stripe.Checkout.Session, notifier?: Notifier): Promise<void> {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
  const kind = session.metadata?.kind;
  const payment = { sessionId: session.id, paymentIntentId: intentId(session.payment_intent), amountTotal: session.amount_total ?? null };
  if (kind === "booking" && session.metadata?.booking_id) {
    await markBookingPaid(db, session.metadata.booking_id, payment, notifier);
  } else if (kind === "membership" && session.metadata?.application_id) {
    await markMembershipPaid(db, session.metadata.application_id, payment, notifier);
  }
}

async function handle(db: Sql, event: Stripe.Event, notifier?: Notifier): Promise<boolean> {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      await fulfilCheckoutSession(db, event.data.object, notifier);
      return true;
    }
    case "checkout.session.async_payment_failed": {
      const s = event.data.object;
      if (s.metadata?.kind === "booking" && s.metadata.booking_id) await releaseBooking(db, s.metadata.booking_id, "payment_failed");
      await db`update public.payments set status = 'failed' where stripe_checkout_session_id = ${s.id} and status = 'pending'`;
      return true;
    }
    case "checkout.session.expired": {
      const s = event.data.object;
      if (s.metadata?.kind === "booking" && s.metadata.booking_id) {
        // If card attempts failed during checkout, record the booking as failed; otherwise it was abandoned.
        const [p] = await db`select failure_message from public.payments where booking_id = ${s.metadata.booking_id} and kind = 'booking'`;
        await releaseBooking(db, s.metadata.booking_id, p?.failure_message ? "payment_failed" : "checkout_expired");
      } else {
        await db`update public.payments set status = 'cancelled' where stripe_checkout_session_id = ${s.id} and status = 'pending'`;
      }
      return true;
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      const message = pi.last_payment_error?.message?.slice(0, 500) ?? "Payment failed";
      if (pi.metadata?.kind === "booking" && pi.metadata.booking_id) {
        // Keep the booking pending: the customer can retry within the same checkout.
        await db`update public.payments set failure_message = ${message}, stripe_payment_intent_id = ${pi.id} where booking_id = ${pi.metadata.booking_id} and kind = 'booking'`;
      }
      return true;
    }
    case "charge.refunded": {
      const charge = event.data.object;
      const pi = intentId(charge.payment_intent);
      if (pi) await applyRefundTotal(db, { paymentIntentId: pi }, charge.amount_refunded, notifier);
      return true;
    }
    default:
      return false;
  }
}

export async function processStripeEvent(db: Sql, event: Stripe.Event, notifier?: Notifier): Promise<WebhookOutcome> {
  const inserted = await db`
    insert into public.stripe_events (id, type) values (${event.id}, ${event.type})
    on conflict (id) do nothing returning id`;
  if (!inserted.length) {
    const [existing] = await db`select processed_at from public.stripe_events where id = ${event.id}`;
    if (existing?.processed_at) return "duplicate";
  }
  try {
    const handled = await handle(db, event, notifier);
    await db`update public.stripe_events set processed_at = now(), error = null where id = ${event.id}`;
    return handled ? "processed" : "ignored";
  } catch (err) {
    await db`update public.stripe_events set error = ${String((err as Error).message).slice(0, 1000)} where id = ${event.id}`;
    throw err;
  }
}
