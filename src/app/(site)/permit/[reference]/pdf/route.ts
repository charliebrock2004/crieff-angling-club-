import { NextResponse, type NextRequest } from "next/server";
import { sql } from "@/lib/db";
import { env } from "@/lib/env";
import { loadBookingForCustomer } from "@/lib/permits/data";
import { conditionsForBooking } from "@/lib/permits/conditions";
import { permitPdf } from "@/lib/permits/pdf";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: RouteContext<"/permit/[reference]/pdf">) {
  const { reference } = await ctx.params;
  const b = await loadBookingForCustomer(sql, reference, req.nextUrl.searchParams.get("t"));
  if (!b) return new NextResponse("Not found", { status: 404 });
  if (b.status !== "paid") return new NextResponse("This booking has no valid permit.", { status: 409 });
  const pdf = await permitPdf(b, env.siteUrl, await conditionsForBooking(sql, b));
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="permit-${b.reference}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
