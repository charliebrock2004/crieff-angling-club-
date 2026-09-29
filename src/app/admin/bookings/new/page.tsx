import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { adminCreateBooking } from "@/lib/admin/booking-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminForm } from "@/components/admin/admin-form";
import { clubToday, isIsoDate } from "@/lib/dates";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBooking({ searchParams }: PageProps<"/admin/bookings/new">) {
  const sp = await searchParams;
  const [beats, permits] = await Promise.all([
    sql`select b.id, b.name, w.name as water, w.id as water_id from public.beats b join public.waters w on w.id = b.water_id order by w.sort_order, b.sort_order`,
    sql`select p.id, p.name, w.name as water from public.permit_types p join public.waters w on w.id = p.water_id where p.is_active order by w.sort_order, p.sort_order`,
  ]);
  const date = typeof sp.date === "string" && isIsoDate(sp.date) ? sp.date : clubToday();
  const beat = typeof sp.beat === "string" ? sp.beat : undefined;
  return (
    <>
      <AdminPageHeader back={{ href: "/admin/bookings", label: "Bookings" }} title="New booking" description="For phone, in-person or complimentary bookings. The same capacity, season and boat rules apply unless you override capacity. Online-only rules (acknowledgements, booking window) are skipped." />
      <AdminForm action={adminCreateBooking} submitLabel="Create booking">
        <div className="space-y-6">
          <section className="card grid gap-5 p-6 sm:grid-cols-3">
            <h2 className="font-display text-xl sm:col-span-3">Fishing</h2>
            <div><label htmlFor="date" className="field-label">Date *</label><input id="date" name="date" type="date" defaultValue={date} required className="input" /></div>
            <div><label htmlFor="beatId" className="field-label">Beat *</label>
              <select id="beatId" name="beatId" defaultValue={beat} required className="input"><option value="">Choose…</option>{beats.map((b) => <option key={b.id} value={b.id}>{b.water === b.name ? b.name : `${b.water} — ${b.name}`}</option>)}</select></div>
            <div><label htmlFor="permitTypeId" className="field-label">Permit type *</label>
              <select id="permitTypeId" name="permitTypeId" required className="input"><option value="">Choose…</option>{permits.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.water})</option>)}</select></div>
            <div className="sm:col-span-3"><label htmlFor="anglers" className="field-label">Anglers — one full name per line *</label><textarea id="anglers" name="anglers" required className="input min-h-24" placeholder={"Angus Mackay\nMorag Mackay"} /><p className="field-hint">One permit is issued per line.</p></div>
          </section>
          <section className="card grid gap-5 p-6 sm:grid-cols-2">
            <h2 className="font-display text-xl sm:col-span-2">Lead customer</h2>
            <div><label htmlFor="firstName" className="field-label">First name *</label><input id="firstName" name="firstName" required className="input" /></div>
            <div><label htmlFor="lastName" className="field-label">Surname *</label><input id="lastName" name="lastName" required className="input" /></div>
            <div><label htmlFor="email" className="field-label">Email *</label><input id="email" name="email" type="email" required className="input" /></div>
            <div><label htmlFor="phone" className="field-label">Phone</label><input id="phone" name="phone" type="tel" className="input" /></div>
            <div><label htmlFor="addressLine1" className="field-label">Address</label><input id="addressLine1" name="addressLine1" className="input" /></div>
            <div><label htmlFor="town" className="field-label">Town</label><input id="town" name="town" className="input" /></div>
            <div><label htmlFor="postcode" className="field-label">Postcode</label><input id="postcode" name="postcode" className="input" /></div>
          </section>
          <section className="card grid gap-5 p-6 sm:grid-cols-3">
            <h2 className="font-display text-xl sm:col-span-3">Payment</h2>
            <div><label htmlFor="method" className="field-label">Paid by *</label>
              <select id="method" name="method" className="input">
                <option value="cash">Cash</option><option value="cheque">Cheque</option><option value="card_in_person">Card (in person)</option><option value="bank_transfer">Bank transfer</option><option value="complimentary">Complimentary (free)</option>
              </select></div>
            <div><label htmlFor="price" className="field-label">Price per permit (£)</label><input id="price" name="price" inputMode="decimal" className="input" placeholder="Leave blank for the standard price" /></div>
            <div><label htmlFor="source" className="field-label">Booked</label><select id="source" name="source" className="input"><option value="phone">By phone</option><option value="in_person">In person</option><option value="admin">Other</option></select></div>
            <label className="flex gap-2 text-sm"><input type="checkbox" name="sendEmail" defaultChecked className="accent-peat" /> Email the permit to the customer</label>
            <label className="flex gap-2 text-sm sm:col-span-2"><input type="checkbox" name="capacityOverride" className="accent-peat" /> Override capacity (allow even if the beat is full or blocked)</label>
            <div className="sm:col-span-3"><label htmlFor="adminNotes" className="field-label">Internal notes</label><textarea id="adminNotes" name="adminNotes" className="input min-h-20" /></div>
          </section>
        </div>
      </AdminForm>
    </>
  );
}
