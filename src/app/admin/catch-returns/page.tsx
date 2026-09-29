import type { Metadata } from "next";
import { sql } from "@/lib/db";
import { deleteCatchReturn } from "@/lib/admin/misc-actions";
import { AdminPageHeader } from "@/components/admin/page-header";
import { ConfirmAction } from "@/components/admin/confirm-action";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Catch returns" };

export default async function CatchReturnsAdmin({ searchParams }: PageProps<"/admin/catch-returns">) {
  const sp = await searchParams;
  const year = Number(typeof sp.year === "string" ? sp.year : new Date().getFullYear());
  const water = typeof sp.water === "string" && /^[0-9a-f-]{36}$/i.test(sp.water) ? sp.water : null;
  const [returns, summary, waters] = await Promise.all([
    sql`select r.*, w.name as water, bt.name as beat, b.reference,
          coalesce((select json_agg(json_build_object('species', s.name, 'quantity', i.quantity, 'weight', i.weight_lb, 'method', i.method, 'released', i.released))
            from public.catch_return_items i join public.species s on s.id = i.species_id where i.catch_return_id = r.id), '[]') as items
        from public.catch_returns r join public.waters w on w.id = r.water_id left join public.beats bt on bt.id = r.beat_id left join public.bookings b on b.id = r.booking_id
        where extract(year from r.fishing_date) = ${year} and (${water}::uuid is null or r.water_id = ${water})
        order by r.fishing_date desc, r.created_at desc limit 500`,
    sql`select s.name, coalesce(bt.name, w.name) as place, sum(i.quantity)::int as fish, sum(i.quantity) filter (where i.released)::int as released, round(max(i.weight_lb), 1) as heaviest
        from public.catch_return_items i join public.catch_returns r on r.id = i.catch_return_id join public.species s on s.id = i.species_id
        join public.waters w on w.id = r.water_id left join public.beats bt on bt.id = r.beat_id
        where extract(year from r.fishing_date) = ${year} and (${water}::uuid is null or r.water_id = ${water})
        group by s.name, s.sort_order, coalesce(bt.name, w.name) order by s.sort_order, place`,
    sql`select id, name from public.waters order by sort_order`,
  ]);
  const blanks = returns.filter((r) => r.is_blank).length;
  return (
    <>
      <AdminPageHeader title="Catch returns" description={`${returns.length} returns in ${year} (${blanks} blank).`} actions={<a href={`/admin/catch-returns/export?year=${year}${water ? `&water=${water}` : ""}`} className={buttonClasses("secondary")}>Export CSV</a>} />
      <form className="mb-6 flex flex-wrap gap-2">
        <select name="year" defaultValue={String(year)} className="input input-sm w-32" aria-label="Year">{Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => <option key={y}>{y}</option>)}</select>
        <select name="water" defaultValue={water ?? ""} className="input input-sm w-48" aria-label="Water"><option value="">All waters</option>{waters.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <button className={buttonClasses("primary", "sm")}>Show</button>
      </form>
      <section className="card mb-8 overflow-x-auto">
        <h2 className="px-5 pt-5 font-display text-xl">Season summary</h2>
        <table className="table-club mt-2">
          <thead><tr><th>Species</th><th>Beat / water</th><th>Fish</th><th>Released</th><th>Heaviest (lb)</th></tr></thead>
          <tbody>
            {summary.map((s, i) => <tr key={i}><td>{s.name}</td><td>{s.place}</td><td>{s.fish}</td><td>{s.released ?? 0}</td><td>{s.heaviest ?? "—"}</td></tr>)}
            {!summary.length && <tr><td colSpan={5} className="text-stone">No fish recorded.</td></tr>}
          </tbody>
        </table>
      </section>
      <div className="card overflow-x-auto">
        <table className="table-club">
          <thead><tr><th>Date</th><th>Angler</th><th>Where</th><th>Catch</th><th>Notes</th><th /></tr></thead>
          <tbody>
            {returns.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{formatDate(r.fishing_date, "short")}</td>
                <td>{r.angler_name} {r.is_member && <Badge tone="accent">Member</Badge>}<span className="block text-xs text-stone">{r.email}{r.reference ? ` · ${r.reference}` : ""}</span></td>
                <td>{r.beat ?? r.water}{r.hours_fished ? <span className="block text-xs text-stone">{r.hours_fished} h</span> : null}</td>
                <td>{r.is_blank ? <Badge>Blank</Badge> : (r.items as { species: string; quantity: number; weight: number | null; method: string | null; released: boolean }[]).map((i, k) => <span key={k} className="block">{i.quantity} × {i.species}{i.weight ? ` ${i.weight}lb` : ""}{i.method ? ` (${i.method})` : ""}{i.released ? " · released" : ""}</span>)}</td>
                <td className="max-w-xs text-stone">{r.notes}</td>
                <td><ConfirmAction action={deleteCatchReturn.bind(null, r.id)} size="sm" label="Delete" title="Delete this return?" confirmLabel="Delete" /></td>
              </tr>
            ))}
            {!returns.length && <tr><td colSpan={6} className="text-stone">No returns for this period.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
