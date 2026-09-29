import type { Metadata } from "next";
import Link from "next/link";
import { requireStaff } from "@/lib/auth";
import { sql } from "@/lib/db";
import { clubToday, isIsoDate } from "@/lib/dates";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Today's permits", robots: { index: false } };
export const dynamic = "force-dynamic";

/** For bailiffs on the bank: every valid permit for a day, grouped by beat. */
export default async function BailiffPage({ searchParams }: PageProps<"/bailiff">) {
  await requireStaff();
  const { date: d } = await searchParams;
  const date = typeof d === "string" && isIsoDate(d) ? d : clubToday();
  const rows = await sql`
    select bt.name as beat, w.name as water, pm.angler_first_name, pm.angler_last_name, pm.permit_number, pm.verification_code, p.name as permit, b.reference,
      (select boat.name from public.boat_bookings bb join public.boats boat on boat.id = bb.boat_id where bb.booking_id = b.id and bb.released_at is null limit 1) as boat
    from public.permits pm join public.bookings b on b.id = pm.booking_id
    join public.beats bt on bt.id = b.beat_id join public.waters w on w.id = b.water_id join public.permit_types p on p.id = b.permit_type_id
    where b.fishing_date = ${date} and b.status = 'paid'
    order by w.sort_order, bt.sort_order, pm.angler_last_name`;
  const groups = Object.groupBy(rows, (r) => (r.beat === r.water ? r.water : `${r.water} · ${r.beat}`));
  return (
    <div className="container-club max-w-3xl py-10">
      <h1 className="display-md">Permits for {formatDate(date, "full")}</h1>
      <form className="mt-4 flex gap-2"><input type="date" name="date" defaultValue={date} className="input max-w-xs" /><button className="rounded-xl bg-peat px-4 text-bone">Show</button></form>
      <p className="mt-2 text-sm text-stone">{rows.length} valid permit{rows.length === 1 ? "" : "s"}. <Link href="/permit/verify" className="link-underline">Scan / verify a permit</Link></p>
      {Object.entries(groups).map(([beat, list]) => (
        <section key={beat} className="mt-8">
          <h2 className="font-display text-2xl">{beat} <span className="text-base text-stone">({list!.length})</span></h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-white">
            {list!.map((r) => (
              <li key={r.permit_number} className="flex items-center justify-between gap-3 px-4 py-3">
                <div><p className="font-semibold">{r.angler_first_name} {r.angler_last_name}</p><p className="text-sm text-stone">{r.permit}{r.boat ? ` · ${r.boat}` : ""} · {r.permit_number}</p></div>
                <Link href={`/permit/verify/${r.verification_code}`} className="text-sm font-semibold text-bracken">Check</Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
