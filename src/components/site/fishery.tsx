import Link from "next/link";
import type { PermitTypePublic, RulePublic, SeasonRow } from "@/lib/content/queries";
import { getCalendar } from "@/lib/booking/public";
import { addDays, clubToday } from "@/lib/dates";
import { formatDate, formatMoney, formatMonthDay, formatWeekdays } from "@/lib/format";
import { cn } from "../ui/cn";

export function PriceTable({ permits, showWater = false }: { permits: PermitTypePublic[]; showWater?: boolean }) {
  return (
    <div className="space-y-4">
      {permits.map((p) => (
        <article key={p.id} className="card p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-2xl">{p.name}</h3>
            {showWater && <span className="text-sm text-stone">{p.waterName}</span>}
          </div>
          {p.description && <p className="mt-2 text-stone">{p.description}</p>}
          {p.beats.length > 0 && <p className="mt-2 text-sm"><span className="font-semibold">Valid on:</span> {p.beats.join(", ")}</p>}
          {p.prices.length > 0 ? (
            <table className="mt-4 w-full text-sm">
              <caption className="sr-only">Prices for {p.name}</caption>
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-stone">
                  <th className="py-2 font-semibold">Period</th>
                  <th className="py-2 font-semibold">Not sold on</th>
                  <th className="py-2 text-right font-semibold">Per day</th>
                </tr>
              </thead>
              <tbody>
                {p.prices.map((x, i) => (
                  <tr key={i} className="border-b border-line/70 last:border-0">
                    <td className="py-2.5">{formatMonthDay(x.startMonth, x.startDay)} – {formatMonthDay(x.endMonth, x.endDay)}</td>
                    <td className="py-2.5 text-stone">{x.closedWeekdays.length ? formatWeekdays(x.closedWeekdays.map(Number)) : "—"}</td>
                    <td className="py-2.5 text-right font-display text-xl">{formatMoney(x.pricePence)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-4 text-sm text-stone">Not currently on sale online.</p>
          )}
          {p.conditions && <p className="mt-4 rounded-xl bg-mist/70 p-3 text-sm text-peat/85">{p.conditions}</p>}
        </article>
      ))}
    </div>
  );
}

export function RuleList({ rules }: { rules: RulePublic[] }) {
  if (!rules.length) return null;
  return (
    <ul className="divide-y divide-line border-y border-line">
      {rules.map((r) => (
        <li key={r.id} className="py-4">
          <p className="font-semibold">{r.title}</p>
          <p className="mt-1 text-stone">{r.body}</p>
        </li>
      ))}
    </ul>
  );
}

export function SeasonList({ seasons }: { seasons: SeasonRow[] }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {seasons.map((s) => (
        <li key={s.id} className="rounded-2xl border border-line bg-white p-4">
          <p className="font-semibold">{s.name}</p>
          <p className="font-display text-xl">{formatMonthDay(s.startMonth, s.startDay)} – {formatMonthDay(s.endMonth, s.endDay)}</p>
          {s.closedWeekdays.length > 0 && <p className="text-sm text-stone">No fishing on {formatWeekdays(s.closedWeekdays)}</p>}
          {s.description && <p className="mt-1 text-sm text-stone">{s.description}</p>}
        </li>
      ))}
    </ul>
  );
}

/** Next two weeks at a glance; each open day links straight into booking. */
export async function AvailabilityStrip({ beatSlug, waterSlug }: { beatSlug?: string; waterSlug?: string }) {
  const today = clubToday();
  const end = addDays(today, 13);
  const months = Array.from(new Set([today.slice(0, 7), end.slice(0, 7)]));
  const results = await Promise.all(months.map((m) => getCalendar(m, { beat: beatSlug, water: waterSlug })));
  const days = results.flatMap((r) => r?.days ?? []).filter((d) => d.date >= today && d.date <= end);
  const q = beatSlug ? `beat=${beatSlug}` : `water=${waterSlug}`;
  return (
    <div>
      <ul className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((d) => {
          const open = d.status === "available" || d.status === "limited";
          const inner = (
            <>
              <span className="text-[0.62rem] font-semibold uppercase tracking-wider opacity-70">{formatDate(d.date, "long").split(" ")[0].replace(",", "")}</span>
              <span className="font-display text-xl leading-none">{Number(d.date.slice(8))}</span>
              <span className="text-[0.62rem] font-medium">{open ? `${d.remaining} left` : d.status === "full" ? "Full" : d.status === "blocked" ? "Closed" : "—"}</span>
            </>
          );
          const cls = cn(
            "flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border text-center transition",
            open ? "border-good/30 bg-good-bg/60 text-good hover:border-good" : d.status === "full" ? "border-bad/20 bg-bad-bg/60 text-bad" : "border-line bg-mist/50 text-stone/60",
          );
          return (
            <li key={d.date}>
              {open ? (
                <Link href={`/book?${q}&date=${d.date}`} className={cls} aria-label={`${formatDate(d.date, "full")}: ${d.remaining} permits left — book`}>{inner}</Link>
              ) : (
                <span className={cls} aria-label={`${formatDate(d.date, "full")}: ${d.status}`}>{inner}</span>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-stone">Visitor day permits, refreshed every few minutes. Tap a day to book — availability is confirmed live when you do.</p>
    </div>
  );
}
