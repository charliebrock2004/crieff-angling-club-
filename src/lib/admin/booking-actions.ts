"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { sql, pgErrorCode } from "../db";
import { assertAdmin } from "../auth";
import { audit } from "../audit";
import { getStripe } from "../stripe";
import { BookingError, cancelBooking, createPendingBooking, refundBooking } from "../booking/service";
import { emailNotifier, sendBookingConfirmation } from "../email/notifier";
import { contactSchema, fieldErrors, isoDate, uuid } from "../validation";
import type { AdminFormState } from "./actions";

const fail = (message: string): AdminFormState => ({ ok: false, message });

function errMessage(err: unknown): string {
  if (err instanceof BookingError) return err.message;
  const code = pgErrorCode(err);
  if (code === "CA001" || code === "CA002") return "That would overbook the beat. Tick “override capacity” if you really mean to.";
  if (code === "23505") return "A boat is already booked for that date.";
  console.error(err);
  return "Something went wrong. Nothing was changed.";
}

export async function adminCancelBooking(bookingId: string, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const reason = String(fd.get("reason") ?? "").trim().slice(0, 300) || "Cancelled by the club";
  const alsoRefund = fd.get("refund") === "on";
  const notify = fd.get("notify") === "on";
  try {
    await cancelBooking(sql, bookingId, { reason, actorId: actor.id }, notify ? emailNotifier : undefined);
    await audit(actor, "booking.cancel", "booking", bookingId, { reason, notify });
    let msg = "Booking cancelled.";
    if (alsoRefund) {
      const r = await refundBooking(sql, getStripe(), bookingId, { reason }, notify ? emailNotifier : undefined);
      await audit(actor, "booking.refund", "booking", bookingId, { amountPence: r.refundedPence, reason });
      msg += ` Refunded £${(r.refundedPence / 100).toFixed(2)}.`;
    }
    revalidatePath(`/admin/bookings/${bookingId}`);
    return { ok: true, message: msg };
  } catch (err) {
    return fail(errMessage(err));
  }
}

export async function adminRefundBooking(bookingId: string, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const raw = String(fd.get("amount") ?? "").replace(/[£,\s]/g, "");
  const amountPence = raw ? Math.round(Number(raw) * 100) : null;
  if (raw && (!Number.isFinite(amountPence) || (amountPence ?? 0) <= 0)) return fail("Enter a valid amount, e.g. 12.50");
  const reason = String(fd.get("reason") ?? "").slice(0, 300);
  try {
    const r = await refundBooking(sql, getStripe(), bookingId, { amountPence, reason }, fd.get("notify") === "on" ? emailNotifier : undefined);
    await audit(actor, "booking.refund", "booking", bookingId, { amountPence: r.refundedPence, reason });
    revalidatePath(`/admin/bookings/${bookingId}`);
    return { ok: true, message: `Refunded £${(r.refundedPence / 100).toFixed(2)}${r.fullyRefunded ? " — booking fully refunded" : ""}.` };
  } catch (err) {
    return fail(errMessage(err));
  }
}

export async function adminResendConfirmation(bookingId: string): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const ok = await sendBookingConfirmation(bookingId).catch(() => false);
  await audit(actor, "booking.resend_email", "booking", bookingId, { ok });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return ok ? { ok: true, message: "Confirmation and permit re-sent." } : fail("The email could not be sent. Check the email log in Settings (is RESEND_API_KEY configured?).");
}

export async function adminClearAttention(bookingId: string): Promise<AdminFormState> {
  const actor = await assertAdmin();
  await sql`update public.bookings set needs_attention = null where id = ${bookingId}`;
  await audit(actor, "booking.clear_attention", "booking", bookingId);
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true, message: "Marked as resolved." };
}

export async function adminUpdateBooking(bookingId: string, _prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const parsed = z
    .object({ date: isoDate, beatId: uuid, adminNotes: z.string().max(2000), capacityOverride: z.boolean(), phone: z.string().max(40) })
    .safeParse({ date: fd.get("date"), beatId: fd.get("beatId"), adminNotes: String(fd.get("adminNotes") ?? ""), capacityOverride: fd.get("capacityOverride") === "on", phone: String(fd.get("phone") ?? "") });
  if (!parsed.success) return fail(Object.values(fieldErrors(parsed.error)).join(" · "));
  const p = parsed.data;
  const [b] = await sql`select * from public.bookings where id = ${bookingId}`;
  if (!b) return fail("Booking not found");
  const [beat] = await sql`select water_id from public.beats where id = ${p.beatId}`;
  if (!beat || beat.water_id !== b.water_id) return fail("A booking can only move to another beat on the same water.");
  const anglers = (await sql`select id from public.permits where booking_id = ${bookingId}`).map((r) => r.id as string);
  try {
    await sql.begin(async (tx) => {
      await tx`update public.bookings set fishing_date = ${p.date}, beat_id = ${p.beatId}, admin_notes = ${p.adminNotes || null},
                 capacity_override = ${p.capacityOverride || b.capacity_override}, contact = contact || ${tx.json({ phone: p.phone })}
               where id = ${bookingId}`;
      if (p.date !== b.fishing_date) await tx`update public.boat_bookings set fishing_date = ${p.date} where booking_id = ${bookingId} and released_at is null`;
      for (const id of anglers) {
        const first = String(fd.get(`angler.${id}.first`) ?? "").trim();
        const last = String(fd.get(`angler.${id}.last`) ?? "").trim();
        if (first && last) await tx`update public.permits set angler_first_name = ${first.slice(0, 80)}, angler_last_name = ${last.slice(0, 80)} where id = ${id} and booking_id = ${bookingId}`;
      }
    });
  } catch (err) {
    return fail(errMessage(err));
  }
  await audit(actor, "booking.update", "booking", bookingId, { from: { date: b.fishing_date, beat: b.beat_id }, to: { date: p.date, beat: p.beatId } });
  revalidatePath(`/admin/bookings/${bookingId}`);
  return { ok: true, message: "Booking updated. Use “Resend permit” to send the customer the updated permit." };
}

export async function adminCreateBooking(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const anglerLines = String(fd.get("anglers") ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const anglers = anglerLines.map((l) => {
    const parts = l.split(/\s+/);
    return { firstName: parts.slice(0, -1).join(" ") || parts[0], lastName: parts.length > 1 ? parts[parts.length - 1] : "-" };
  });
  const contact = contactSchema.safeParse({
    firstName: fd.get("firstName"),
    lastName: fd.get("lastName"),
    email: fd.get("email"),
    phone: fd.get("phone") || "00000000",
    addressLine1: fd.get("addressLine1") || "Not given",
    addressLine2: fd.get("addressLine2") ?? "",
    town: fd.get("town") || "Not given",
    postcode: fd.get("postcode") || "UNKNOWN",
  });
  if (!contact.success) return fail(Object.values(fieldErrors(contact.error)).join(" · "));
  const base = z.object({ date: isoDate, beatId: uuid, permitTypeId: uuid }).safeParse({ date: fd.get("date"), beatId: fd.get("beatId"), permitTypeId: fd.get("permitTypeId") });
  if (!base.success) return fail("Choose a date, beat and permit type.");
  const quantity = Math.max(1, anglers.length || 1);
  if (!anglers.length) anglers.push({ firstName: contact.data.firstName, lastName: contact.data.lastName });
  const method = String(fd.get("method") ?? "cash");
  if (!["cash", "cheque", "card_in_person", "bank_transfer", "complimentary"].includes(method)) return fail("Choose a payment method.");
  const priceRaw = String(fd.get("price") ?? "").replace(/[£,\s]/g, "");
  const unitPriceOverridePence = method === "complimentary" ? 0 : priceRaw ? Math.round(Number(priceRaw) * 100) : null;
  if (unitPriceOverridePence !== null && (!Number.isFinite(unitPriceOverridePence) || unitPriceOverridePence < 0)) return fail("Enter a valid price.");

  let id: string;
  try {
    const created = await createPendingBooking(
      sql,
      { ...base.data, quantity, anglers, contact: contact.data, acknowledgedRuleIds: [], juniorConfirmed: true, website: "" },
      {
        source: (fd.get("source") === "phone" ? "phone" : fd.get("source") === "in_person" ? "in_person" : "admin") as "admin",
        markPaidMethod: method,
        capacityOverride: fd.get("capacityOverride") === "on",
        ignoreBookingWindow: true,
        adminNotes: String(fd.get("adminNotes") ?? "").slice(0, 2000) || null,
        createdBy: actor.id,
        unitPriceOverridePence,
      },
    );
    id = created.id;
  } catch (err) {
    return fail(errMessage(err));
  }
  await audit(actor, "booking.create_manual", "booking", id, { method });
  if (fd.get("sendEmail") === "on") await sendBookingConfirmation(id).catch(() => null);
  revalidatePath("/admin/bookings");
  redirect(`/admin/bookings/${id}?saved=1`);
}

// --- Availability ------------------------------------------------------------

export async function adminAddOverride(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const scope = String(fd.get("scope") ?? "");
  const [kind, scopeId] = scope.split(":");
  const start = String(fd.get("startDate") ?? "");
  const end = String(fd.get("endDate") ?? "") || start;
  const mode = fd.get("mode") === "capacity" ? "capacity" : "block";
  const capacity = mode === "capacity" ? Number(fd.get("capacity")) : null;
  const permitTypeId = String(fd.get("permitTypeId") ?? "") || null;
  if (!isoDate.safeParse(start).success || !isoDate.safeParse(end).success || end < start) return fail("Enter a valid date range.");
  if (mode === "capacity" && (!Number.isInteger(capacity) || capacity! < 0 || capacity! > 500)) return fail("Enter a capacity between 0 and 500.");
  if (!["club", "water", "beat"].includes(kind) || (kind !== "club" && !uuid.safeParse(scopeId).success)) return fail("Choose where this applies.");
  try {
    const [row] = await sql`
      insert into public.availability_overrides (water_id, beat_id, permit_type_id, start_date, end_date, is_blocked, capacity, reason, public_note, created_by)
      values (${kind === "water" ? scopeId : null}, ${kind === "beat" ? scopeId : null}, ${mode === "block" ? permitTypeId : null}, ${start}, ${end},
              ${mode === "block"}, ${capacity}, ${String(fd.get("reason") ?? "").slice(0, 300) || null}, ${String(fd.get("publicNote") ?? "").slice(0, 200) || null}, ${actor.id})
      returning id`;
    await audit(actor, mode === "block" ? "availability.block" : "availability.capacity", "availability_override", row.id, { scope, start, end, capacity });
  } catch (err) {
    return fail(err instanceof Error && /check/.test(err.message) ? "That range is too long (max ~13 months) or invalid." : "Could not save.");
  }
  const [{ n }] = await sql`
    select count(*)::int as n from public.bookings b join public.beats bt on bt.id = b.beat_id
    where b.status = 'paid' and b.fishing_date between ${start} and ${end}
      and (${kind} = 'club' or (${kind} = 'water' and bt.water_id = ${kind === "water" ? scopeId : null}) or (${kind} = 'beat' and b.beat_id = ${kind === "beat" ? scopeId : null}))`;
  revalidatePath("/", "layout");
  return { ok: true, message: mode === "block" ? `Blocked. ${n ? `Note: ${n} paid booking(s) already exist in this period — review them in Bookings.` : "No existing bookings are affected."}` : "Capacity updated." };
}

export async function adminRemoveOverride(id: string): Promise<AdminFormState> {
  const actor = await assertAdmin();
  await sql`delete from public.availability_overrides where id = ${id}`;
  await audit(actor, "availability.remove", "availability_override", id);
  revalidatePath("/", "layout");
  return { ok: true, message: "Removed." };
}

export async function adminSetBeatCapacities(_prev: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const beats = await sql`select id, daily_capacity from public.beats`;
  const changes: Record<string, number> = {};
  for (const b of beats) {
    const v = fd.get(`cap.${b.id}`);
    if (v === null) continue;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 500) return fail("Capacities must be whole numbers between 0 and 500.");
    if (n !== b.daily_capacity) changes[b.id] = n;
  }
  for (const [id, n] of Object.entries(changes)) await sql`update public.beats set daily_capacity = ${n} where id = ${id}`;
  await audit(actor, "availability.default_capacity", "beats", null, changes);
  revalidatePath("/", "layout");
  return { ok: true, message: Object.keys(changes).length ? "Default capacities updated." : "No changes." };
}
