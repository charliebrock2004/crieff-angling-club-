import type { Metadata } from "next";
import Link from "next/link";
import { adminCalendar, type AdminDayState } from "@/lib/admin/calendar";
import { AdminPageHeader } from "@/components/admin/page-header";
import { buttonClasses } from "@/components/ui/button";
import { clubToday, monthBounds } from "@/lib/dates";
import { cn } from "@/components/ui/cn";

export const metadata: Metadata = { title: "Calendar" };

const STATE: Record<AdminDayState, string> = {
  open: "bg-good-bg text-good",
  booked: "bg-info-bg text-info",
  full: "bg-bad text-white",
  blocked: "bg-mist text-stone [background-image:repeating-linear-gradient(135deg,transparent_0_4px,rgb(20_34_29/0.08)_4px_5px)]",
  closed: "bg-transparent text-stone/40",
};

function shift(month: string, d: number) {
  const [y, m] = month.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1 + d, 1));
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function AdminCalendarPage({ searchParams }: PageProps<"/admin/calendar">) {
  const sp = await searchParams;
  const today = clubToday();
  const month = typeof sp.month === "string" && monthBounds(sp.month) ? sp.month : today.slice(0, 7);
  const { start, end } = monthBounds(month)!;
  const { beats, days } = await adminCalendar(start, end);
  const [y, m] = month.split("-").map(Number);
  const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7;
  const label = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  const short = (n: string) => n.split(" ").map((w) => w[0]).join("").slice(0, 3).toUpperCase();

  return (
    <>
      <AdminPageHeader
        title="Calendar"
        description="Booked / capacity for every beat, every day. Click a day to see its bookings, block it, or change its capacity."
        actions={
          <>
            <Link href={`/admin/calendar?month=${shift(month, -1)}`} className={buttonClasses("secondary", "sm")}>← Previous</Link>
            <Link href="/admin/calendar" className={buttonClasses("ghost", "sm")}>Today</Link>
            <Link href={`/admin/calendar?month=${shift(month, 1)}`} className={buttonClasses("secondary", "sm")}>Next →</Link>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl">{label}</h2>
        <ul className="flex flex-wrap gap-3 text-xs">
          {(["open", "booked", "full", "blocked", "closed"] as AdminDayState[]).map((s) => (
            <li key={s} className="flex items-center gap-1.5"><span className={cn("inline-block h-3 w-5 rounded border border-line", STATE[s])} />{s === "open" ? "Available" : s === "closed" ? "Out of season" : s[0].toUpperCase() + s.slice(1)}</li>
          ))}
        </ul>
      </div>
      <p className="mb-3 text-xs text-stone">Key: {beats.map((b) => `${short(b.name)} = ${b.name}`).join(" · ")}</p>
      <div className="card overflow-x-auto p-3">
        <div className="grid min-w-[760px] grid-cols-7 gap-1.5">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-stone">{d}</div>)}
          {Array.from({ length: lead }, (_, i) => <div key={`e${i}`} />)}
          {days.map((d) => (
            <Link key={d.date} href={`/admin/calendar/${d.date}`} className={cn("rounded-xl border border-line bg-white p-2 transition hover:border-peat hover:shadow-md", d.date === today && "ring-2 ring-bracken")}>
              <p className="text-sm font-semibold">{Number(d.date.slice(8))}</p>
              <ul className="mt-1 space-y-0.5">
                {d.beats.map((b) => (
                  <li key={b.beatId} className={cn("flex justify-between rounded px-1 text-[0.68rem] font-medium", STATE[b.state])} title={`${b.beatName}: ${b.booked}/${b.capacity} ${b.state}${b.note ? ` — ${b.note}` : ""}`}>
                    <span>{short(b.beatName)}</span>
                    <span>{b.state === "closed" ? "–" : b.state === "blocked" ? "✕" : `${b.booked}/${b.capacity}`}</span>
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
