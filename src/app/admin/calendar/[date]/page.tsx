import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { adminCalendar } from "@/lib/admin/calendar";
import { adminAddOverride, adminRemoveOverride } from "@/lib/admin/booking-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Badge, BookingStatusBadge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { addDays, isIsoDate } from "@/lib/dates";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Day" };

export default async function AdminDay({ params }: PageProps<"/admin/calendar/[date]">) {
  const { date } = await params;
  if (!isIsoDate(date)) notFound();
  const [{ days }, bookings, overrides] = await Promise.all([
    adminCalendar(date, date),
    sql`select b.id, b.reference, b.quantity, b.status, b.total_pence, b.contact, b.beat_id, p.name as permit,
          (select string_agg(pm.angler_first_name || ' ' || pm.angler_last_name, ', ') from public.permits pm where pm.booking_id = b.id) as anglers,
          (select boat.name from public.boat_bookings bb join public.boats boat on boat.id = bb.boat_id where bb.booking_id = b.id and bb.released_at is null limit 1) as boat
        from public.bookings b join public.permit_types p on p.id = b.permit_type_id
        where b.fishing_date = ${date} and (b.status in ('paid', 'refunded') or (b.status = 'pending' and b.hold_expires_at > now()) or (b.status = 'cancelled' and b.paid_at is not null))
        order by b.created_at`,
    sql`select o.*, w.name as water_name, bt.name as beat_name, p.name as permit_name from public.availability_overrides o
        left join public.waters w on w.id = o.water_id left join public.beats bt on bt.id = o.beat_id left join public.permit_types p on p.id = o.permit_type_id
        where ${date} between o.start_date and o.end_date order by o.created_at`,
  ]);
  const day = days[0];
  return (
    <>
      <AdminPageHeader
        back={{ href: `/admin/calendar?month=${date.slice(0, 7)}`, label: "Calendar" }}
        title={formatDate(date, "full")}
        actions={
          <>
            <Link href={`/admin/calendar/${addDays(date, -1)}`} className={buttonClasses("secondary", "sm")}>← Previous day</Link>
            <Link href={`/admin/calendar/${addDays(date, 1)}`} className={buttonClasses("secondary", "sm")}>Next day →</Link>
            <ButtonLink href={`/admin/bookings/new?date=${date}`} size="sm">New booking</ButtonLink>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {day.beats.map((b) => (
          <section key={b.beatId} className="card p-5">
            <p className="text-xs text-stone">{b.waterName}</p>
            <h2 className="font-display text-xl">{b.beatName}</h2>
            <p className="mt-3 font-display text-4xl">{b.booked}<span className="text-lg text-stone"> / {b.capacity}</span></p>
            <p className="text-sm text-stone">booked{b.boatsTotal !== null ? ` · boats ${b.boatsTaken}/${b.boatsTotal}` : ""}</p>
            <p className="mt-2">
              <Badge tone={b.state === "full" ? "bad" : b.state === "blocked" ? "dark" : b.state === "closed" ? "neutral" : "good"}>{b.state === "open" || b.state === "booked" ? `${Math.max(0, b.capacity - b.booked)} left` : b.state === "closed" ? "Out of season" : b.state}</Badge>
            </p>
            {b.note && <p className="mt-2 text-sm text-stone">{b.note}</p>}
            <ButtonLink href={`/admin/bookings/new?date=${date}&beat=${b.beatId}`} variant="secondary" size="sm" className="mt-4">Add booking</ButtonLink>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl">Bookings</h2>
        <div className="card mt-4 overflow-x-auto">
          {bookings.length ? (
            <table className="table-club">
              <thead><tr><th>Ref</th><th>Beat</th><th>Anglers</th><th>Permit</th><th>Customer</th><th className="text-right">Total</th><th>Status</th></tr></thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}>
                    <td><Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold hover:underline">{b.reference}</Link></td>
                    <td>{day.beats.find((x) => x.beatId === b.beat_id)?.beatName}{b.boat ? ` · ${b.boat}` : ""}</td>
                    <td>{b.anglers}</td>
                    <td>{b.quantity} × {b.permit}</td>
                    <td>{b.contact.firstName} {b.contact.lastName}<span className="block text-xs text-stone">{b.contact.phone}</span></td>
                    <td className="text-right">{formatMoney(b.total_pence)}</td>
                    <td><BookingStatusBadge status={b.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="p-5 text-stone">No bookings on this day.</p>}
        </div>
      </section>

      <section className="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="font-display text-2xl">Blocks & capacity changes</h2>
          <ul className="mt-4 space-y-3">
            {overrides.map((o) => (
              <li key={o.id} className="card flex items-start justify-between gap-4 p-4">
                <div className="text-sm">
                  <p className="font-semibold">{o.is_blocked ? "Blocked" : `Capacity ${o.capacity}`} — {o.beat_name ?? o.water_name ?? "whole club"}{o.permit_name ? ` (${o.permit_name} only)` : ""}</p>
                  <p className="text-stone">{formatDate(o.start_date, "short")}{o.end_date !== o.start_date ? ` – ${formatDate(o.end_date, "short")}` : ""}{o.reason ? ` · ${o.reason}` : ""}</p>
                  {o.public_note && <p className="text-stone">Shown to anglers: “{o.public_note}”</p>}
                </div>
                <ConfirmAction action={adminRemoveOverride.bind(null, o.id)} label={o.is_blocked ? "Unblock" : "Remove"} size="sm" title={o.is_blocked ? "Unblock?" : "Remove capacity change?"} body={o.start_date !== o.end_date ? "This removes the whole date range, not just this day." : undefined} confirmLabel="Remove" />
              </li>
            ))}
            {!overrides.length && <li className="text-sm text-stone">None — normal availability applies.</li>}
          </ul>
        </div>
        <div>
          <h2 className="font-display text-2xl">Block or change capacity</h2>
          <AdminForm action={adminAddOverride} submitLabel="Apply" resetOnSuccess>
            <div className="card mt-4 grid gap-4 p-5 sm:grid-cols-2">
              <input type="hidden" name="startDate" value={date} />
              <div className="sm:col-span-2"><label htmlFor="scope" className="field-label">Applies to</label>
                <select id="scope" name="scope" className="input">
                  {day.beats.map((b) => <option key={b.beatId} value={`beat:${b.beatId}`}>{b.waterName === b.beatName ? b.beatName : `${b.waterName} — ${b.beatName}`}</option>)}
                  <option value="club:">All waters</option>
                </select></div>
              <div><label htmlFor="mode" className="field-label">Action</label><select id="mode" name="mode" className="input"><option value="block">Block (no bookings)</option><option value="capacity">Set capacity</option></select></div>
              <div><label htmlFor="capacity" className="field-label">Capacity (if setting)</label><input id="capacity" name="capacity" type="number" min={0} max={500} className="input" /></div>
              <div><label htmlFor="endDate" className="field-label">Until (optional)</label><input id="endDate" name="endDate" type="date" min={date} className="input" /></div>
              <div><label htmlFor="reason" className="field-label">Internal reason</label><input id="reason" name="reason" className="input" placeholder="e.g. Club competition" /></div>
              <div className="sm:col-span-2"><label htmlFor="publicNote" className="field-label">Message shown to anglers (optional)</label><input id="publicNote" name="publicNote" className="input" placeholder="e.g. Closed for the club competition" /></div>
            </div>
          </AdminForm>
        </div>
      </section>
    </>
  );
}
