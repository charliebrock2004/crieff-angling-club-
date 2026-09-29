import "server-only";
import { sql } from "../db";
import { env } from "../env";
import { claimNotification, releaseNotificationClaim, type Notifier } from "../booking/service";
import { loadBooking } from "../permits/data";
import { conditionsForBooking } from "../permits/conditions";
import { permitPdf } from "../permits/pdf";
import { getSettings } from "../settings";
import { sendEmail } from "./send";
import {
  adminAlertEmail,
  adminNewBookingEmail,
  bookingConfirmationEmail,
  cancellationEmail,
  membershipConfirmedEmail,
  paymentReceiptEmail,
  refundEmail,
} from "./templates";

async function adminAddress(): Promise<string | null> {
  try {
    return (await getSettings()).adminNotificationEmail ?? env.adminNotificationEmail ?? null;
  } catch {
    return env.adminNotificationEmail ?? null;
  }
}

/** Send (or re-send) the confirmation + permit PDF + receipt for a paid booking. */
export async function sendBookingConfirmation(bookingId: string): Promise<boolean> {
  const b = await loadBooking(sql, { id: bookingId });
  if (!b || b.status !== "paid") return false;
  const siteUrl = env.siteUrl;
  const conditions = await conditionsForBooking(sql, b);
  const pdf = Buffer.from(await permitPdf(b, siteUrl, conditions));
  const r = await sendEmail(b.contact.email, "booking_confirmation", bookingConfirmationEmail(b, { siteUrl, conditions }), {
    bookingId,
    attachments: [{ filename: `permit-${b.reference}.pdf`, content: pdf }],
  });
  await sendEmail(b.contact.email, "payment_receipt", paymentReceiptEmail(b, { siteUrl }), { bookingId });
  return r.status === "sent";
}

export const emailNotifier: Notifier = {
  async bookingConfirmed(bookingId) {
    if (await claimNotification(sql, bookingId, "confirmation_sent_at")) {
      const ok = await sendBookingConfirmation(bookingId).catch((e) => {
        console.error(e);
        return false;
      });
      // Leave the claim in place even on failure (avoids duplicate sends);
      // the failure is visible in admin with a "Resend" button.
      if (!ok) console.error(`confirmation email not delivered for booking ${bookingId}`);
    }
    if (await claimNotification(sql, bookingId, "admin_notified_at")) {
      const to = await adminAddress();
      const b = await loadBooking(sql, { id: bookingId });
      if (to && b) await sendEmail(to, "admin_new_booking", adminNewBookingEmail(b, { siteUrl: env.siteUrl }), { bookingId });
      else if (!to) await releaseNotificationClaim(sql, bookingId, "admin_notified_at");
    }
  },
  async bookingCancelled(bookingId) {
    if (!(await claimNotification(sql, bookingId, "cancellation_notified_at"))) return;
    const b = await loadBooking(sql, { id: bookingId });
    if (b) await sendEmail(b.contact.email, "booking_cancelled", cancellationEmail(b, { siteUrl: env.siteUrl }), { bookingId });
  },
  async bookingRefunded(bookingId) {
    // Partial refunds can happen more than once, so no claim here: one email per refund recorded.
    const b = await loadBooking(sql, { id: bookingId });
    if (b) await sendEmail(b.contact.email, "booking_refunded", refundEmail(b, { siteUrl: env.siteUrl }), { bookingId });
  },
  async membershipPaid(applicationId) {
    const [m] = await sql`
      select a.first_name, a.email, t.name as type_name, m.membership_number, m.expires_on, m.amount_paid_pence
      from public.membership_applications a
      join public.membership_types t on t.id = a.membership_type_id
      join public.memberships m on m.application_id = a.id
      where a.id = ${applicationId}`;
    if (!m) return;
    const claimed = await sql`update public.membership_applications set confirmation_sent_at = now() where id = ${applicationId} and confirmation_sent_at is null returning id`;
    if (!claimed.length) return;
    await sendEmail(
      m.email,
      "membership_confirmed",
      membershipConfirmedEmail({ firstName: m.first_name, typeName: m.type_name, membershipNumber: m.membership_number, expiresOn: m.expires_on, totalPence: m.amount_paid_pence }, { siteUrl: env.siteUrl }),
      { membershipApplicationId: applicationId },
    );
    const to = await adminAddress();
    if (to) await sendEmail(to, "admin_membership_paid", adminAlertEmail("Membership paid", `${m.first_name} has paid for ${m.type_name} (${m.membership_number}).`, { siteUrl: env.siteUrl }), { membershipApplicationId: applicationId });
  },
  async needsAttention(subject, message) {
    const to = await adminAddress();
    if (to) await sendEmail(to, "admin_alert", adminAlertEmail(subject, message, { siteUrl: env.siteUrl }));
    else console.error(`[needs attention] ${subject}: ${message}`);
  },
};
