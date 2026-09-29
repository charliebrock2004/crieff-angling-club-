import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { queryBookings, readFilters } from "@/lib/admin/bookings-query";
import { AdminPageHeader, Flash } from "@/components/admin/page-header";
import { BookingStatusBadge, Badge } from "@/components/ui/badge";
import { ButtonLink, buttonClasses } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/section";
import { formatDate, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage({ searchParams }: PageProps<"/admin/bookings">) {
  const sp = await searchParams;
  const f = readFilters(sp);
  const [{ rows, total }, waters, beats, permits] = await Promise.all([
    queryBookings(f),
    sql`select id, name from public.waters order by sort_order`,
    sql`select b.id, b.name, w.name as water from public.beats b join public.waters w on w.id = b.water_id order by w.sort_order, b.sort_order`,
    sql`select id, name from public.permit_types order by sort_order`,
  ]);
  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => typeof v === "string")) as Record<string, string>, ...over })) if (v) p.set(k, v);
    return `?${p}`;
  };
  const sortLink = (key: string, label: string) => {
    const active = (f.sort ?? "created") === key;
    const dir = active && f.dir !== "asc" ? "asc" : "desc";
    return <Link href={qs({ sort: key, dir, page: undefined })} className={active ? "text-peat" : ""}>{label}{active ? (f.dir === "asc" ? " ↑" : " ↓") : ""}</Link>;
  };
  const pages = Math.max(1, Math.ceil(total / 50));
  return (
    <>
      <AdminPageHeader
        title="Bookings"
        description={`${total} booking${total === 1 ? "" : "s"} match. Abandoned checkouts are hidden unless you filter by status.`}
        actions={<><a href={`/admin/bookings/export${qs({})}`} className={buttonClasses("secondary")}>Export CSV</a><ButtonLink href="/admin/bookings/new">New booking</ButtonLink></>}
      />
      <Flash sp={sp} />
      <form className="card mb-6 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4" role="search">
        <div className="sm:col-span-2"><label htmlFor="q" className="field-label">Search</label><input id="q" name="q" defaultValue={f.q} placeholder="Reference, name, email, permit no." className="input input-sm" /></div>
        <div><label htmlFor="status" className="field-label">Status</label>
          <select id="status" name="status" defaultValue={f.status ?? ""} className="input input-sm"><option value="">Active & paid</option>{["paid", "pending", "cancelled", "refunded", "failed"].map((s) => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></div>
        <div><label htmlFor="water" className="field-label">Water</label>
          <select id="water" name="water" defaultValue={f.water ?? ""} className="input input-sm"><option value="">All</option>{waters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></div>
        <div><label htmlFor="beat" className="field-label">Beat</label>
          <select id="beat" name="beat" defaultValue={f.beat ?? ""} className="input input-sm"><option value="">All</option>{beats.map((b) => <option key={b.id} value={b.id}>{b.water === b.name ? b.name : `${b.water} — ${b.name}`}</option>)}</select></div>
        <div><label htmlFor="permit" className="field-label">Permit</label>
          <select id="permit" name="permit" defaultValue={f.permit ?? ""} className="input input-sm"><option value="">All</option>{permits.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
        <div><label htmlFor="from" className="field-label">Fishing from</label><input id="from" name="from" type="date" defaultValue={f.from} className="input input-sm" /></div>
        <div><label htmlFor="to" className="field-label">Fishing to</label><input id="to" name="to" type="date" defaultValue={f.to} className="input input-sm" /></div>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
          <button className={buttonClasses("primary", "sm")}>Apply filters</button>
          <Link href="/admin/bookings" className={buttonClasses("ghost", "sm")}>Clear</Link>
          <Link href="/admin/bookings?attention=1" className={buttonClasses("ghost", "sm")}>Needs attention</Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title="No bookings match" action={<ButtonLink href="/admin/bookings" variant="secondary">Clear filters</ButtonLink>} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-club">
            <thead>
              <tr>
                <th>{sortLink("ref", "Reference")}</th><th>{sortLink("date", "Date")}</th><th>{sortLink("customer", "Customer")}</th>
                <th>Water / beat</th><th>Permit</th><th className="text-right">{sortLink("amount", "Amount")}</th><th>Payment</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td><Link href={`/admin/bookings/${b.id}`} className="font-mono font-semibold hover:underline">{b.reference}</Link>{b.needs_attention && <span className="ml-1" title={b.needs_attention}>⚠️</span>}</td>
                  <td className="whitespace-nowrap">{formatDate(b.fishing_date, "short")}</td>
                  <td>{b.contact.firstName} {b.contact.lastName}<span className="block text-xs text-stone">{b.contact.email}</span></td>
                  <td>{b.beat === b.water ? b.water : <>{b.beat}<span className="block text-xs text-stone">{b.water}</span></>}</td>
                  <td>{b.quantity} × {b.permit}</td>
                  <td className="text-right whitespace-nowrap">{formatMoney(b.total_pence)}{b.amount_refunded_pence > 0 && <span className="block text-xs text-info">−{formatMoney(b.amount_refunded_pence)}</span>}</td>
                  <td><Badge tone={b.payment_status === "succeeded" ? "good" : b.payment_status === "pending" ? "warn" : "neutral"}>{b.payment_method === "stripe" ? "Card" : String(b.payment_method ?? "").replace(/_/g, " ")} · {b.payment_status ?? "—"}</Badge></td>
                  <td><BookingStatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-stone">Page {f.page} of {pages}</span>
          <span className="flex gap-2">
            {(f.page ?? 1) > 1 && <Link href={qs({ page: String((f.page ?? 1) - 1) })} className={buttonClasses("secondary", "sm")}>Previous</Link>}
            {(f.page ?? 1) < pages && <Link href={qs({ page: String((f.page ?? 1) + 1) })} className={buttonClasses("secondary", "sm")}>Next</Link>}
          </span>
        </nav>
      )}
    </>
  );
}
