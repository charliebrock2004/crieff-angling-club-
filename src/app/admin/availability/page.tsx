import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { adminAddOverride, adminRemoveOverride, adminSetBeatCapacities } from "@/lib/admin/booking-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminForm } from "@/components/admin/admin-form";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Badge } from "@/components/ui/badge";
import { clubToday } from "@/lib/dates";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const today = clubToday();
  const [beats, waters, permits, overrides, settings] = await Promise.all([
    sql`select b.id, b.name, b.daily_capacity, w.name as water from public.beats b join public.waters w on w.id = b.water_id order by w.sort_order, b.sort_order`,
    sql`select id, name from public.waters order by sort_order`,
    sql`select id, name from public.permit_types order by sort_order`,
    sql`select o.*, w.name as water_name, bt.name as beat_name, p.name as permit_name from public.availability_overrides o
        left join public.waters w on w.id = o.water_id left join public.beats bt on bt.id = o.beat_id left join public.permit_types p on p.id = o.permit_type_id
        where o.end_date >= ${today} order by o.start_date limit 200`,
    sql`select key, value from public.settings where key in ('booking_hold_minutes','booking_max_days_ahead','booking_same_day_cutoff_hour')`,
  ]);
  const s = Object.fromEntries(settings.map((r) => [r.key, r.value]));
  return (
    <>
      <AdminPageHeader title="Availability" description="How many visitor permits can be sold, and when. Seasons and prices are set under Fishing seasons and Permit types." />
      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-2xl">Default permits per day</h2>
          <p className="mt-1 text-sm text-stone">Applies every day unless a date below says otherwise. Loch capacity is anglers (boats are limited separately).</p>
          <AdminForm action={adminSetBeatCapacities} submitLabel="Save capacities">
            <div className="card mt-4 divide-y divide-line">
              {beats.map((b) => (
                <label key={b.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <span>{b.water === b.name ? b.name : `${b.water} — ${b.name}`}</span>
                  <input name={`cap.${b.id}`} type="number" min={0} max={500} defaultValue={b.daily_capacity} className="input input-sm w-24 text-right" aria-label={`Capacity for ${b.name}`} />
                </label>
              ))}
            </div>
          </AdminForm>
          <div className="card mt-6 p-5 text-sm">
            <p className="font-semibold">Booking window</p>
            <p className="mt-1 text-stone">Book up to {String(s.booking_max_days_ahead)} days ahead · same-day booking closes at {String(s.booking_same_day_cutoff_hour)}:00 · permits held {String(s.booking_hold_minutes)} minutes during checkout.</p>
            <Link href="/admin/settings" className="link-underline mt-2 inline-block font-semibold">Change in Settings</Link>
          </div>
        </section>
        <section>
          <h2 className="font-display text-2xl">Block dates or change capacity</h2>
          <p className="mt-1 text-sm text-stone">For competitions, closures, floods, or special days. Existing paid bookings are not cancelled automatically.</p>
          <AdminForm action={adminAddOverride} submitLabel="Add" resetOnSuccess>
            <div className="card mt-4 grid gap-4 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2"><label htmlFor="scope" className="field-label">Applies to</label>
                <select id="scope" name="scope" className="input">
                  <option value="club:">All waters (whole club)</option>
                  {waters.map((w) => <option key={w.id} value={`water:${w.id}`}>{w.name} — all beats</option>)}
                  {beats.map((b) => <option key={b.id} value={`beat:${b.id}`}>{b.water === b.name ? b.name : `${b.water} — ${b.name}`}</option>)}
                </select></div>
              <div><label htmlFor="startDate" className="field-label">From *</label><input id="startDate" name="startDate" type="date" required min={today} className="input" /></div>
              <div><label htmlFor="endDate" className="field-label">To (inclusive)</label><input id="endDate" name="endDate" type="date" min={today} className="input" /></div>
              <div><label htmlFor="mode" className="field-label">Action</label><select id="mode" name="mode" className="input"><option value="block">Block — no bookings</option><option value="capacity">Special capacity</option></select></div>
              <div><label htmlFor="capacity" className="field-label">Capacity (special only)</label><input id="capacity" name="capacity" type="number" min={0} max={500} className="input" /></div>
              <div className="sm:col-span-2"><label htmlFor="permitTypeId" className="field-label">Block only this permit (optional)</label>
                <select id="permitTypeId" name="permitTypeId" className="input"><option value="">All permits</option>{permits.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label htmlFor="reason" className="field-label">Internal reason</label><input id="reason" name="reason" className="input" /></div>
              <div><label htmlFor="publicNote" className="field-label">Message to anglers</label><input id="publicNote" name="publicNote" className="input" placeholder="Shown on the calendar" /></div>
            </div>
          </AdminForm>
        </section>
      </div>
      <section className="mt-10">
        <h2 className="font-display text-2xl">Upcoming blocks & special dates</h2>
        <div className="card mt-4 overflow-x-auto">
          {overrides.length ? (
            <table className="table-club">
              <thead><tr><th>Dates</th><th>Where</th><th>What</th><th>Reason</th><th /></tr></thead>
              <tbody>
                {overrides.map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap">{formatDate(o.start_date, "short")}{o.end_date !== o.start_date ? ` – ${formatDate(o.end_date, "short")}` : ""}</td>
                    <td>{o.beat_name ?? (o.water_name ? `${o.water_name} (all)` : "Whole club")}</td>
                    <td>{o.is_blocked ? <Badge tone="dark">Blocked{o.permit_name ? `: ${o.permit_name}` : ""}</Badge> : <Badge tone="info">Capacity {o.capacity}</Badge>}</td>
                    <td className="text-stone">{o.reason ?? "—"}{o.public_note ? <span className="block text-xs">“{o.public_note}”</span> : null}</td>
                    <td className="text-right"><ConfirmAction action={adminRemoveOverride.bind(null, o.id)} label="Remove" size="sm" title="Remove this?" confirmLabel="Remove" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="p-5 text-stone">Nothing scheduled.</p>}
        </div>
      </section>
    </>
  );
}
