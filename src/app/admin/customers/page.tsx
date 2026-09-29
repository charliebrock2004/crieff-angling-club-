import type { Metadata } from "next";
import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ searchParams }: PageProps<"/admin/customers">) {
  const { q } = await searchParams;
  const like = typeof q === "string" && q.trim() ? `%${q.trim().replace(/[%_]/g, "")}%` : null;
  const rows = await sql`
    select c.id, c.first_name, c.last_name, c.email, c.phone, c.postcode, c.user_id,
      count(b.id) filter (where b.status = 'paid')::int as bookings,
      coalesce(sum(b.total_pence - b.amount_refunded_pence) filter (where b.status in ('paid', 'refunded')), 0)::int as spent,
      max(b.fishing_date) filter (where b.status = 'paid') as last_date,
      exists (select 1 from public.memberships m where m.customer_id = c.id and m.status = 'active' and m.expires_on >= current_date) as member
    from public.customers c left join public.bookings b on b.customer_id = c.id
    where ${like}::text is null or c.email ilike ${like} or (c.first_name || ' ' || c.last_name) ilike ${like} or c.phone ilike ${like} or c.postcode ilike ${like}
    group by c.id order by max(b.created_at) desc nulls last, c.created_at desc limit 200`;
  return (
    <>
      <AdminPageHeader title="Customers" description="Everyone who has booked, applied for membership, or been added manually." />
      <form className="mb-6 flex gap-2" role="search">
        <input name="q" defaultValue={typeof q === "string" ? q : ""} placeholder="Name, email, phone or postcode" className="input input-sm max-w-md" aria-label="Search customers" />
        <button className={buttonClasses("primary", "sm")}>Search</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-club">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Bookings</th><th className="text-right">Spent</th><th>Last fished</th><th /></tr></thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/customers/${c.id}`} className="font-semibold hover:underline">{c.first_name} {c.last_name}</Link> {c.member && <Badge tone="accent">Member</Badge>} {c.user_id && <Badge>Account</Badge>}</td>
                <td>{c.email}</td><td>{c.phone ?? "—"}</td><td>{c.bookings}</td><td className="text-right">{formatMoney(c.spent)}</td><td>{c.last_date ?? "—"}</td>
                <td className="text-right"><Link href={`/admin/customers/${c.id}`} className="text-sm font-semibold text-bracken">Open</Link></td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={7} className="text-stone">No customers found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
