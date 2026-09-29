import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { AdminForm } from "@/components/admin/admin-form";
import { BookingStatusBadge, Badge } from "@/components/ui/badge";
import { updateCustomer } from "@/lib/admin/misc-actions";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: PageProps<"/admin/customers/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [c] = await sql`select * from public.customers where id = ${id}`;
  if (!c) notFound();
  const [bookings, memberships, returns] = await Promise.all([
    sql`select b.id, b.reference, b.fishing_date, b.quantity, b.total_pence, b.status, bt.name as beat, p.name as permit from public.bookings b
        join public.beats bt on bt.id = b.beat_id join public.permit_types p on p.id = b.permit_type_id where b.customer_id = ${id} order by b.fishing_date desc`,
    sql`select m.*, t.name from public.memberships m join public.membership_types t on t.id = m.membership_type_id where m.customer_id = ${id} order by m.expires_on desc`,
    sql`select r.fishing_date, r.is_blank, (select coalesce(sum(quantity), 0) from public.catch_return_items i where i.catch_return_id = r.id)::int as fish from public.catch_returns r where r.email = ${c.email} order by r.fishing_date desc limit 20`,
  ]);
  return (
    <>
      <AdminPageHeader back={{ href: "/admin/customers", label: "Customers" }} title={`${c.first_name} ${c.last_name}`} description={c.email} />
      <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <AdminForm action={updateCustomer.bind(null, id)}>
          <div className="card grid gap-4 p-5 sm:grid-cols-2">
            {[["first_name", "First name"], ["last_name", "Surname"], ["phone", "Phone"], ["address_line1", "Address"], ["address_line2", "Address line 2"], ["town", "Town"], ["postcode", "Postcode"]].map(([k, l]) => (
              <div key={k}><label htmlFor={k} className="field-label">{l}</label><input id={k} name={k} defaultValue={c[k] ?? ""} className="input input-sm" /></div>
            ))}
            <div className="sm:col-span-2"><label htmlFor="notes" className="field-label">Internal notes</label><textarea id="notes" name="notes" defaultValue={c.notes ?? ""} className="input min-h-20" /></div>
          </div>
        </AdminForm>
        <div className="space-y-6">
          <section className="card overflow-x-auto">
            <h2 className="px-5 pt-5 font-display text-xl">Bookings</h2>
            <table className="table-club mt-2">
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id}><td><Link href={`/admin/bookings/${b.id}`} className="font-mono hover:underline">{b.reference}</Link></td><td>{formatDate(b.fishing_date, "short")}</td><td>{b.quantity} × {b.permit} · {b.beat}</td><td>{formatMoney(b.total_pence)}</td><td><BookingStatusBadge status={b.status} /></td></tr>
                ))}
                {!bookings.length && <tr><td className="text-stone">None.</td></tr>}
              </tbody>
            </table>
          </section>
          <section className="card p-5">
            <h2 className="font-display text-xl">Membership</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {memberships.map((m) => <li key={m.id} className="flex justify-between"><span>{m.name} · {m.membership_number}</span><span>until {formatDate(m.expires_on, "short")} <Badge tone={m.status === "active" ? "good" : "neutral"}>{m.status}</Badge></span></li>)}
              {!memberships.length && <li className="text-stone">Not a member.</li>}
            </ul>
          </section>
          <section className="card p-5">
            <h2 className="font-display text-xl">Catch returns</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {returns.map((r, i) => <li key={i}>{formatDate(r.fishing_date, "short")} — {r.is_blank ? "blank" : `${r.fish} fish`}</li>)}
              {!returns.length && <li className="text-stone">None.</li>}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
