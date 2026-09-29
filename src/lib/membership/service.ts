/**
 * Membership: applications join a waiting list (the old site's process),
 * the committee offers a place, and the applicant pays online through a
 * secure link. Payment activates the membership.
 */
import type Stripe from "stripe";
import type { Sql } from "../db";
import { clubToday, diffDays, nextOccurrence, addDays, type IsoDate } from "../dates";
import { BookingError, type Notifier, type StripeLike } from "../booking/service";

export function membershipExpiry(today: IsoDate, month: number, day: number): IsoDate {
  // Next occurrence of the expiry date; if that is under 60 days away the
  // membership runs to the following year's expiry instead.
  const next = nextOccurrence(today, month, day);
  return diffDays(next, today) < 60 ? nextOccurrence(addDays(next, 1), month, day) : next;
}

export async function applicationAmount(db: Sql, applicationId: string) {
  const [a] = await db`
    select a.*, t.name as type_name, t.price_pence, t.joining_fee_pence
    from public.membership_applications a join public.membership_types t on t.id = a.membership_type_id
    where a.id = ${applicationId}`;
  if (!a) return null;
  const joining = a.include_joining_fee ? a.joining_fee_pence : 0;
  return { application: a, pricePence: a.price_pence as number, joiningFeePence: joining as number, totalPence: (a.price_pence + joining) as number };
}

export async function startMembershipCheckout(
  db: Sql,
  applicationId: string,
  deps: { stripe: StripeLike | null; siteUrl: string },
): Promise<string> {
  if (!deps.stripe) throw new BookingError("payments_unavailable", "Online payment is not available at the moment. Please contact the club.");
  const amt = await applicationAmount(db, applicationId);
  if (!amt) throw new BookingError("not_found", "Application not found.");
  const a = amt.application;
  if (a.status !== "offered") throw new BookingError("invalid_state", a.status === "paid" ? "This membership has already been paid." : "This application is not ready for payment.");

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { quantity: 1, price_data: { currency: "gbp", unit_amount: amt.pricePence, product_data: { name: a.type_name } } },
  ];
  if (amt.joiningFeePence > 0) {
    lineItems.push({ quantity: 1, price_data: { currency: "gbp", unit_amount: amt.joiningFeePence, product_data: { name: "Joining fee (first year)" } } });
  }
  const session = await deps.stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: a.email,
    client_reference_id: a.id,
    line_items: lineItems,
    metadata: { kind: "membership", application_id: a.id, reference: a.reference },
    payment_intent_data: { metadata: { kind: "membership", application_id: a.id, reference: a.reference } },
    success_url: `${deps.siteUrl}/membership/pay/${a.reference}?t=${encodeURIComponent(a.access_token)}&paid=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${deps.siteUrl}/membership/pay/${a.reference}?t=${encodeURIComponent(a.access_token)}`,
  });
  await db`
    insert into public.payments (kind, membership_application_id, stripe_checkout_session_id, amount_pence, status)
    values ('membership', ${a.id}, ${session.id}, ${amt.totalPence}, 'pending')`;
  if (!session.url) throw new BookingError("payment_error", "Stripe did not return a payment link.");
  return session.url;
}

/** Idempotent: activates the membership once. */
export async function markMembershipPaid(
  db: Sql,
  applicationId: string,
  payment: { sessionId: string | null; paymentIntentId: string | null; amountTotal: number | null },
  notifier?: Notifier,
): Promise<{ changed: boolean }> {
  const changed = await db.begin(async (tx) => {
    const [a] = await tx`
      select a.*, t.expiry_month, t.expiry_day
      from public.membership_applications a join public.membership_types t on t.id = a.membership_type_id
      where a.id = ${applicationId} for update of a`;
    if (!a) throw new BookingError("not_found", "Application not found");
    if (payment.sessionId) {
      await tx`
        update public.payments set status = 'succeeded', stripe_payment_intent_id = ${payment.paymentIntentId}
        where stripe_checkout_session_id = ${payment.sessionId}`;
    }
    if (a.status === "paid") return false;

    const [customer] = await tx`
      insert into public.customers (user_id, first_name, last_name, email, phone, address_line1, address_line2, town, postcode)
      values (${a.user_id}, ${a.first_name}, ${a.last_name}, ${a.email}, ${a.phone}, ${a.address_line1}, ${a.address_line2}, ${a.town}, ${a.postcode})
      on conflict (email) do update set user_id = coalesce(public.customers.user_id, excluded.user_id)
      returning id`;
    const today = clubToday();
    await tx`
      insert into public.memberships (membership_number, membership_type_id, customer_id, application_id, starts_on, expires_on, status, amount_paid_pence)
      values ('M' || nextval('public.membership_number_seq')::text, ${a.membership_type_id}, ${customer.id}, ${a.id}, ${today},
              ${membershipExpiry(today, a.expiry_month, a.expiry_day)}, 'active', ${payment.amountTotal ?? 0})`;
    await tx`update public.membership_applications set status = 'paid', paid_at = now(), customer_id = ${customer.id} where id = ${a.id}`;
    return true;
  });
  if (changed && notifier) await notifier.membershipPaid(applicationId);
  return { changed };
}
