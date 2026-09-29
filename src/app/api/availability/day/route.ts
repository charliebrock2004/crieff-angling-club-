import { NextResponse, type NextRequest } from "next/server";
import { getDayOptions } from "@/lib/booking/public";
import { isIsoDate } from "@/lib/dates";
import { rateLimit } from "@/lib/request";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!(await rateLimit("availability", 240, 60))) {
    return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
  }
  const date = req.nextUrl.searchParams.get("date");
  if (!isIsoDate(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  try {
    return NextResponse.json({ date, ...(await getDayOptions(date)) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("day availability failed", err);
    return NextResponse.json({ error: "Availability is temporarily unavailable." }, { status: 500 });
  }
}
