import { NextResponse, type NextRequest } from "next/server";
import { getCalendar } from "@/lib/booking/public";
import { rateLimit } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await rateLimit("availability", 240, 60))) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }
  const p = req.nextUrl.searchParams;
  const month = p.get("month") ?? "";
  try {
    const result = await getCalendar(month, { water: p.get("water"), beat: p.get("beat"), permit: p.get("permit") });
    if (!result) return NextResponse.json({ error: "Invalid month" }, { status: 400 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("calendar availability failed", err);
    return NextResponse.json({ error: "Availability is temporarily unavailable." }, { status: 500 });
  }
}
