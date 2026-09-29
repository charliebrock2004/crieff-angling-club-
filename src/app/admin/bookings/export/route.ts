import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth";
import { queryBookings, readFilters } from "@/lib/admin/bookings-query";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET(req: NextRequest) {
  const v = await getViewer();
  if (!v || v.role !== "admin") return new NextResponse("Not found", { status: 404 });
  const f = readFilters(Object.fromEntries(req.nextUrl.searchParams));
  const { rows } = await queryBookings({ ...f, page: 1 }, 10000);
  const header = ["Reference", "Fishing date", "Water", "Beat", "Permit", "Quantity", "Total (£)", "Refunded (£)", "Status", "Payment", "Source", "First name", "Surname", "Email", "Phone", "Postcode", "Created"];
  const lines = rows.map((b) =>
    [b.reference, b.fishing_date, b.water, b.beat, b.permit, b.quantity, (b.total_pence / 100).toFixed(2), (b.amount_refunded_pence / 100).toFixed(2), b.status, `${b.payment_method}/${b.payment_status}`, b.source, b.contact.firstName, b.contact.lastName, b.contact.email, b.contact.phone, b.contact.postcode, new Date(b.created_at).toISOString()].map(cell).join(","),
  );
  await audit(v, "bookings.export", "bookings", null, { count: rows.length });
  return new NextResponse([header.map(cell).join(","), ...lines].join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="bookings-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}
