"use server";
import { redirect } from "next/navigation";
import { databaseNotReadyMessage, isEphemeralDatabase, sql } from "../db";
import { env } from "../env";
import { getViewer } from "../auth";
import { rateLimit } from "../request";
import { accessToken, membershipReference, safeEqual } from "../ids";
import { sendEmail } from "../email/send";
import { adminAlertEmail, membershipApplicationReceivedEmail } from "../email/templates";
import { getSettings } from "../settings";
import { fieldErrors, membershipApplicationSchema } from "../validation";
import { startMembershipCheckout } from "../membership/service";
import { BookingError } from "../booking/service";
import { getStripe } from "../stripe";
import type { FormState } from "./public";

export async function applyForMembership(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("membership", 5, 3600))) return { ok: false, message: "Too many applications from this connection. Please try again later." };
  const parsed = membershipApplicationSchema.safeParse({ ...Object.fromEntries(fd), isRenewal: fd.get("isRenewal") === "on" });
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) };
  const a = parsed.data;
  if (a.website) return { ok: true, message: "Thank you." };
  if (isEphemeralDatabase) return { ok: false, message: databaseNotReadyMessage };
  const [type] = await sql`select id, name, online_application_enabled from public.membership_types where id = ${a.membershipTypeId} and is_active`;
  if (!type || !type.online_application_enabled) return { ok: false, errors: { membershipTypeId: "Choose a membership type" } };
  const [existing] = await sql`select reference from public.membership_applications where email = ${a.email} and membership_type_id = ${type.id} and status in ('submitted', 'waiting_list', 'offered')`;
  if (existing) return { ok: false, message: `You already have an open application (${existing.reference}). The secretary will be in touch.` };

  const viewer = await getViewer().catch(() => null);
  const reference = membershipReference();
  await sql`
    insert into public.membership_applications (reference, access_token, membership_type_id, user_id, first_name, last_name, email, phone,
      address_line1, address_line2, town, postcode, date_of_birth, is_renewal, statement, include_joining_fee)
    values (${reference}, ${accessToken()}, ${type.id}, ${viewer?.emailConfirmed && viewer.email === a.email ? viewer.id : null}, ${a.firstName}, ${a.lastName},
      ${a.email}, ${a.phone}, ${a.addressLine1}, ${a.addressLine2 || null}, ${a.town}, ${a.postcode}, ${a.dateOfBirth || null}, ${a.isRenewal}, ${a.statement || null}, ${!a.isRenewal})`;
  await sendEmail(a.email, "membership_received", membershipApplicationReceivedEmail({ firstName: a.firstName, typeName: type.name, reference }, { siteUrl: env.siteUrl }));
  const settings = await getSettings().catch(() => null);
  const admin = settings?.adminNotificationEmail ?? env.adminNotificationEmail;
  if (admin) await sendEmail(admin, "admin_membership_application", adminAlertEmail("New membership application", `${a.firstName} ${a.lastName} applied for ${type.name} (${reference}).`, { siteUrl: env.siteUrl }));
  return { ok: true, message: `Thank you — your application (${reference}) has been received. We've emailed you a copy.` };
}

export async function payForMembership(fd: FormData) {
  const reference = String(fd.get("reference") ?? "");
  const token = String(fd.get("t") ?? "");
  const [a] = await sql`select id, access_token from public.membership_applications where reference = ${reference}`;
  if (!a || !safeEqual(a.access_token, token)) redirect("/membership");
  let url: string;
  try {
    url = await startMembershipCheckout(sql, a.id, { stripe: getStripe(), siteUrl: env.siteUrl });
  } catch (err) {
    const msg = err instanceof BookingError ? err.message : "Payment could not be started.";
    redirect(`/membership/pay/${reference}?t=${encodeURIComponent(token)}&error=${encodeURIComponent(msg)}`);
  }
  redirect(url);
}
