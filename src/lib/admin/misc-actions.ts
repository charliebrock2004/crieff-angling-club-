"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { sql } from "../db";
import { env } from "../env";
import { assertAdmin } from "../auth";
import { audit } from "../audit";
import { sendEmail } from "../email/send";
import { membershipOfferEmail } from "../email/templates";
import { applicationAmount } from "../membership/service";
import { deleteStoredImage, uploadImage } from "./images";
import type { AdminFormState } from "./actions";

const ok = (message: string): AdminFormState => ({ ok: true, message });
const fail = (message: string): AdminFormState => ({ ok: false, message });
const UUID = /^[0-9a-f-]{36}$/i;

// --- Customers -----------------------------------------------------------------
export async function updateCustomer(id: string, _p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const s = (k: string, max = 120) => {
    const v = String(fd.get(k) ?? "").trim().slice(0, max);
    return v || null;
  };
  const first = s("first_name", 80);
  const last = s("last_name", 80);
  if (!first || !last) return fail("First name and surname are required.");
  await sql`update public.customers set first_name = ${first}, last_name = ${last}, phone = ${s("phone", 40)}, address_line1 = ${s("address_line1")},
              address_line2 = ${s("address_line2")}, town = ${s("town", 80)}, postcode = ${s("postcode", 12)}, notes = ${s("notes", 4000)} where id = ${id}`;
  await audit(actor, "customer.update", "customer", id);
  return ok("Customer updated.");
}

// --- Membership ------------------------------------------------------------------
export async function setApplicationStatus(id: string, status: "waiting_list" | "rejected" | "withdrawn", fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const note = String(fd.get("note") ?? "").slice(0, 1000) || null;
  const rows = await sql`update public.membership_applications set status = ${status}, admin_notes = coalesce(${note}, admin_notes), decided_by = ${actor.id}, decided_at = now()
                         where id = ${id} and status not in ('paid') returning id`;
  if (!rows.length) return fail("This application has already been paid.");
  await audit(actor, `membership.${status}`, "membership_application", id, { note });
  revalidatePath("/admin/membership");
  return ok("Updated.");
}

/** Offer a place: the applicant is emailed a secure link to pay online. */
export async function offerMembership(id: string, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const includeJoining = fd.get("joiningFee") === "on";
  const rows = await sql`update public.membership_applications set status = 'offered', offered_at = now(), include_joining_fee = ${includeJoining}, decided_by = ${actor.id}, decided_at = now()
                         where id = ${id} and status in ('submitted', 'waiting_list', 'offered') returning reference, access_token, first_name, email`;
  if (!rows.length) return fail("This application can't be offered a place (already paid or closed).");
  const a = rows[0];
  const amt = (await applicationAmount(sql, id))!;
  const payUrl = `${env.siteUrl}/membership/pay/${a.reference}?t=${encodeURIComponent(a.access_token)}`;
  const r = await sendEmail(a.email, "membership_offer", membershipOfferEmail({ firstName: a.first_name, typeName: amt.application.type_name, totalPence: amt.totalPence, payUrl }, { siteUrl: env.siteUrl }), { membershipApplicationId: id });
  await audit(actor, "membership.offer", "membership_application", id, { includeJoining, email: r.status });
  revalidatePath("/admin/membership");
  return r.status === "sent" ? ok("Offer sent. The applicant has been emailed a payment link.") : ok(`Marked as offered, but the email was not sent (${r.error ?? r.status}). Payment link: ${payUrl}`);
}

export async function recordManualMembershipPayment(id: string, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const method = String(fd.get("method") ?? "cash");
  const { markMembershipPaid } = await import("../membership/service");
  const { emailNotifier } = await import("../email/notifier");
  const amt = await applicationAmount(sql, id);
  if (!amt) return fail("Application not found.");
  await sql`insert into public.payments (kind, membership_application_id, amount_pence, status, method) values ('membership', ${id}, ${amt.totalPence}, 'succeeded', ${method})`;
  await markMembershipPaid(sql, id, { sessionId: null, paymentIntentId: null, amountTotal: amt.totalPence }, emailNotifier);
  await audit(actor, "membership.manual_payment", "membership_application", id, { method });
  revalidatePath("/admin/membership");
  return ok("Payment recorded and membership activated.");
}

export async function cancelMembership(id: string): Promise<AdminFormState> {
  const actor = await assertAdmin();
  await sql`update public.memberships set status = 'cancelled' where id = ${id}`;
  await audit(actor, "membership.cancel", "membership", id);
  revalidatePath("/admin/membership");
  return ok("Membership cancelled.");
}

// --- Gallery -----------------------------------------------------------------------
export async function uploadGalleryImages(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const files = fd.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) return fail("Choose one or more photos.");
  if (files.length > 20) return fail("Upload up to 20 photos at a time.");
  const categoryId = String(fd.get("categoryId") ?? "");
  const waterId = String(fd.get("waterId") ?? "");
  const beatId = String(fd.get("beatId") ?? "");
  const credit = String(fd.get("credit") ?? "").slice(0, 120) || null;
  const [{ max }] = await sql`select coalesce(max(sort_order), 0)::int as max from public.gallery_images`;
  let done = 0;
  const errors: string[] = [];
  for (const [i, file] of files.entries()) {
    try {
      const img = await uploadImage(file, "gallery");
      await sql`insert into public.gallery_images (category_id, water_id, beat_id, storage_path, url, width, height, alt, credit, sort_order)
                values (${UUID.test(categoryId) ? categoryId : null}, ${UUID.test(waterId) ? waterId : null}, ${UUID.test(beatId) ? beatId : null},
                        ${img.path}, ${img.url}, ${img.width}, ${img.height}, ${file.name.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ").slice(0, 200)}, ${credit}, ${max + i + 1})`;
      done++;
    } catch (err) {
      errors.push(`${file.name}: ${(err as Error).message}`);
    }
  }
  await audit(actor, "gallery.upload", "gallery_images", null, { count: done });
  revalidatePath("/", "layout");
  if (!done) return fail(errors.join(" · "));
  return ok(`${done} photo${done === 1 ? "" : "s"} uploaded. Add a description (alt text) to each below.${errors.length ? ` Some failed: ${errors.join(" · ")}` : ""}`);
}

export async function updateGalleryImage(id: string, _p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const s = (k: string, max: number) => String(fd.get(k) ?? "").trim().slice(0, max);
  const cat = s("categoryId", 40);
  const beat = s("beatId", 40);
  const water = s("waterId", 40);
  await sql`update public.gallery_images set alt = ${s("alt", 300)}, caption = ${s("caption", 500) || null}, credit = ${s("credit", 120) || null},
              category_id = ${UUID.test(cat) ? cat : null}, water_id = ${UUID.test(water) ? water : null}, beat_id = ${UUID.test(beat) ? beat : null},
              is_published = ${fd.get("is_published") === "on"} where id = ${id}`;
  await audit(actor, "gallery.update", "gallery_image", id);
  revalidatePath("/", "layout");
  return ok("Saved.");
}

export async function moveGalleryImage(id: string, direction: "up" | "down"): Promise<AdminFormState> {
  await assertAdmin();
  const rows = await sql`select id, sort_order from public.gallery_images order by sort_order, created_at`;
  const i = rows.findIndex((r) => r.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= rows.length) return ok("");
  await sql.begin(async (tx) => {
    // Normalise ordering, then swap.
    for (const [k, r] of rows.entries()) await tx`update public.gallery_images set sort_order = ${k === i ? j : k === j ? i : k} where id = ${r.id}`;
  });
  revalidatePath("/", "layout");
  return ok("");
}

export async function deleteGalleryImage(id: string): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const [img] = await sql`delete from public.gallery_images where id = ${id} returning storage_path`;
  if (img) await deleteStoredImage(img.storage_path).catch(() => null);
  await audit(actor, "gallery.delete", "gallery_image", id);
  revalidatePath("/", "layout");
  return ok("Photo deleted.");
}

// --- Settings ------------------------------------------------------------------------
const SETTING_SCHEMAS: Record<string, z.ZodType> = {
  club_name: z.string().trim().min(1).max(120),
  contact_email: z.union([z.literal(""), z.string().trim().email()]),
  contact_phone: z.string().trim().max(40),
  contact_address: z.string().trim().max(400),
  facebook_url: z.union([z.literal(""), z.string().trim().url()]),
  fishpal_url: z.union([z.literal(""), z.string().trim().url()]),
  water_level_url: z.union([z.literal(""), z.string().trim().url()]),
  booking_hold_minutes: z.coerce.number().int().min(30).max(120),
  booking_max_days_ahead: z.coerce.number().int().min(1).max(730),
  booking_same_day_cutoff_hour: z.coerce.number().int().min(0).max(24),
  admin_notification_email: z.union([z.literal(""), z.string().trim().email()]),
  announcement: z.string().trim().max(240),
};

export async function saveSettings(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const errors: string[] = [];
  const updates: [string, unknown, boolean][] = [];
  for (const [key, schema] of Object.entries(SETTING_SCHEMAS)) {
    if (!fd.has(key)) continue;
    const r = schema.safeParse(fd.get(key));
    if (!r.success) errors.push(`${key.replace(/_/g, " ")}: ${r.error.issues[0].message}`);
    else updates.push([key, r.data === "" ? null : r.data, fd.get(`${key}__confirmed`) === "on"]);
  }
  const outlets = String(fd.get("permit_outlets") ?? "");
  if (fd.has("permit_outlets")) {
    const list = outlets.split(/\n+/).map((l) => l.split("|").map((x) => x.trim())).filter((p) => p[0]).map(([name, phone, notes]) => ({ name, phone: phone || null, notes: notes || null }));
    updates.push(["permit_outlets", list, fd.get("permit_outlets__confirmed") === "on"]);
  }
  if (errors.length) return fail(errors.join(" · "));
  for (const [key, value, confirmed] of updates) {
    await sql`update public.settings set value = ${sql.json(value as never)}, updated_by = ${actor.id}, updated_at = now(),
                needs_confirmation = case when ${confirmed} then false else needs_confirmation end where key = ${key}`;
  }
  await audit(actor, "settings.update", "settings", null, { keys: updates.map((u) => u[0]) });
  revalidatePath("/", "layout");
  return ok("Settings saved.");
}

export async function setUserRole(_p: AdminFormState, fd: FormData): Promise<AdminFormState> {
  const actor = await assertAdmin();
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const role = String(fd.get("role") ?? "");
  if (!["angler", "bailiff", "admin"].includes(role)) return fail("Choose a role.");
  const [p] = await sql`select id, role from public.profiles where email = ${email}`;
  if (!p) return fail("No account with that email. Ask them to create an account first (Sign in → Create an account).");
  if (p.id === actor.id && role !== "admin") return fail("You can't remove your own admin access.");
  if (p.role === "admin" && role !== "admin") {
    const [{ n }] = await sql`select count(*)::int as n from public.profiles where role = 'admin'`;
    if (n <= 1) return fail("There must be at least one admin.");
  }
  await sql`update public.profiles set role = ${role} where id = ${p.id}`;
  await audit(actor, "user.role", "profile", p.id, { email, from: p.role, to: role });
  revalidatePath("/admin/settings");
  return ok(`${email} is now ${role === "angler" ? "a regular user" : `a${role === "admin" ? "n" : ""} ${role}`}.`);
}

export async function markMessageHandled(id: string): Promise<AdminFormState> {
  const actor = await assertAdmin();
  await sql`update public.contact_messages set handled_at = now() where id = ${id}`;
  await audit(actor, "message.handled", "contact_message", id);
  revalidatePath("/admin/settings/messages");
  return ok("Marked as handled.");
}

export async function deleteCatchReturn(id: string): Promise<AdminFormState> {
  const actor = await assertAdmin();
  await sql`delete from public.catch_returns where id = ${id}`;
  await audit(actor, "catch_return.delete", "catch_return", id);
  revalidatePath("/admin/catch-returns");
  return ok("Deleted.");
}
