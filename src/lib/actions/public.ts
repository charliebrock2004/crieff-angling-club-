"use server";
import { databaseNotReadyMessage, isEphemeralDatabase, sql } from "../db";
import { env } from "../env";
import { getViewer } from "../auth";
import { rateLimit } from "../request";
import { sendEmail } from "../email/send";
import { contactNotificationEmail } from "../email/templates";
import { getSettings } from "../settings";
import { clubToday } from "../dates";
import { catchReturnSchema, contactMessageSchema, fieldErrors } from "../validation";

export type FormState = { ok: boolean; message?: string; errors?: Record<string, string> } | null;

export async function submitContact(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("contact", 5, 3600))) return { ok: false, message: "You've sent several messages recently. Please try again later." };
  const parsed = contactMessageSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) };
  const m = parsed.data;
  if (m.website) return { ok: true, message: "Thank you — your message has been sent." };
  if (isEphemeralDatabase) return { ok: false, message: databaseNotReadyMessage };
  await sql`insert into public.contact_messages (name, email, phone, subject, message) values (${m.name}, ${m.email}, ${m.phone || null}, ${m.subject}, ${m.message})`;
  const settings = await getSettings().catch(() => null);
  const to = settings?.adminNotificationEmail ?? settings?.contactEmail ?? env.adminNotificationEmail;
  if (to) await sendEmail(to, "contact_message", contactNotificationEmail({ ...m, phone: m.phone ?? "" }, { siteUrl: env.siteUrl }), { replyTo: m.email });
  return { ok: true, message: "Thank you — your message has been sent. The club secretary will reply as soon as possible." };
}

function bool(v: FormDataEntryValue | null) {
  return v === "on" || v === "true" || v === "1";
}

export async function submitCatchReturn(_prev: FormState, fd: FormData): Promise<FormState> {
  if (!(await rateLimit("catch", 20, 3600))) return { ok: false, message: "Too many returns from this connection. Please try again later." };
  const count = Math.min(30, Number(fd.get("itemCount") ?? 0) || 0);
  const items = [];
  for (let i = 0; i < count; i++) {
    if (!fd.get(`items.${i}.speciesId`)) continue;
    items.push({
      speciesId: fd.get(`items.${i}.speciesId`),
      quantity: fd.get(`items.${i}.quantity`),
      weightLb: fd.get(`items.${i}.weightLb`) ?? "",
      lengthIn: fd.get(`items.${i}.lengthIn`) ?? "",
      method: fd.get(`items.${i}.method`) ?? "",
      released: bool(fd.get(`items.${i}.released`)),
    });
  }
  const parsed = catchReturnSchema.safeParse({
    anglerName: fd.get("anglerName"),
    email: fd.get("email"),
    fishingDate: fd.get("fishingDate"),
    waterId: fd.get("waterId"),
    beatId: fd.get("beatId") ?? "",
    hoursFished: fd.get("hoursFished") ?? "",
    isBlank: bool(fd.get("isBlank")),
    permitReference: String(fd.get("permitReference") ?? "").toUpperCase(),
    notes: fd.get("notes") ?? "",
    items,
    website: fd.get("website") ?? "",
  });
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", errors: fieldErrors(parsed.error) };
  const r = parsed.data;
  if (r.website) return { ok: true, message: "Thank you." };
  if (isEphemeralDatabase) return { ok: false, message: databaseNotReadyMessage };
  if (!r.isBlank && r.items.length === 0) return { ok: false, message: "Add at least one fish, or tick “blank day” if you caught nothing.", errors: { items: "Add a fish or mark a blank day" } };
  if (r.fishingDate > clubToday()) return { ok: false, errors: { fishingDate: "The date can't be in the future" } };

  const [beat] = r.beatId ? await sql`select water_id from public.beats where id = ${r.beatId}` : [null];
  if (beat && beat.water_id !== r.waterId) return { ok: false, errors: { beatId: "That beat isn't on the selected water" } };

  const viewer = await getViewer().catch(() => null);
  // Link to a booking only if the reference AND email match (no enumeration of other anglers' bookings).
  let bookingId: string | null = null;
  if (r.permitReference) {
    const [b] = await sql`select id from public.bookings where reference = ${r.permitReference} and contact->>'email' = ${r.email}`;
    if (!b) return { ok: false, errors: { permitReference: "We couldn't match that reference to your email address" } };
    bookingId = b.id;
  }
  const [member] = viewer ? await sql`select 1 from public.memberships m join public.customers c on c.id = m.customer_id where c.user_id = ${viewer.id} and m.status = 'active' limit 1` : [];

  await sql.begin(async (tx) => {
    const [ret] = await tx`
      insert into public.catch_returns (user_id, booking_id, angler_name, email, is_member, fishing_date, water_id, beat_id, hours_fished, is_blank, notes)
      values (${viewer?.id ?? null}, ${bookingId}, ${r.anglerName}, ${r.email}, ${!!member}, ${r.fishingDate}, ${r.waterId}, ${r.beatId ?? null}, ${r.hoursFished}, ${r.isBlank}, ${r.notes || null})
      returning id`;
    if (!r.isBlank) {
      for (const it of r.items) {
        await tx`insert into public.catch_return_items (catch_return_id, species_id, quantity, weight_lb, length_in, method, released)
                 values (${ret.id}, ${it.speciesId}, ${it.quantity}, ${it.weightLb}, ${it.lengthIn}, ${it.method || null}, ${it.released})`;
      }
    }
  });
  return { ok: true, message: "Thank you — your catch return has been recorded." };
}
