import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";
const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${(/^[=+\-@\t\r]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  const v = await getViewer();
  if (!v || v.role !== "admin") return new NextResponse("Not found", { status: 404 });
  const year = Number(req.nextUrl.searchParams.get("year")) || new Date().getFullYear();
  const water = req.nextUrl.searchParams.get("water");
  const rows = await sql`
    select r.fishing_date, r.angler_name, r.email, r.is_member, w.name as water, bt.name as beat, r.hours_fished, r.is_blank,
           s.name as species, i.quantity, i.weight_lb, i.length_in, i.method, i.released, r.notes
    from public.catch_returns r join public.waters w on w.id = r.water_id left join public.beats bt on bt.id = r.beat_id
    left join public.catch_return_items i on i.catch_return_id = r.id left join public.species s on s.id = i.species_id
    where extract(year from r.fishing_date) = ${year} and (${water && /^[0-9a-f-]{36}$/i.test(water) ? water : null}::uuid is null or r.water_id = ${water && /^[0-9a-f-]{36}$/i.test(water) ? water : null})
    order by r.fishing_date`;
  const header = ["Date", "Angler", "Email", "Member", "Water", "Beat", "Hours", "Blank", "Species", "Number", "Weight lb", "Length in", "Method", "Released", "Notes"];
  const body = rows.map((r) => [r.fishing_date, r.angler_name, r.email, r.is_member ? "yes" : "no", r.water, r.beat, r.hours_fished, r.is_blank ? "yes" : "no", r.species, r.quantity, r.weight_lb, r.length_in, r.method, r.released === null ? "" : r.released ? "yes" : "no", r.notes].map(cell).join(","));
  return new NextResponse([header.map(cell).join(","), ...body].join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="catch-returns-${year}.csv"` } });
}
