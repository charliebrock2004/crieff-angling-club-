import { formatMonthDay, formatWeekdays } from "@/lib/format";
import type { SeasonRow } from "@/lib/content/queries";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const dayOfYear = (m: number, d: number) => Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 86400000);
const COLORS: Record<string, string> = { salmon: "#b8782e", "sea-trout": "#3b5566", "brown-trout": "#4f6f55", grayling: "#7a5a78" };

/** Year timeline of every published season (handles seasons that wrap New Year). */
export function SeasonChart({ seasons }: { seasons: SeasonRow[] }) {
  return (
    <div className="card overflow-hidden p-5 sm:p-8">
      <div className="grid grid-cols-[minmax(7rem,11rem)_1fr] gap-x-4 text-[0.7rem] font-semibold uppercase tracking-wider text-stone">
        <span />
        <div className="grid grid-cols-12">
          {MONTHS.map((m, i) => (
            <span key={i} className="text-center">{m}</span>
          ))}
        </div>
      </div>
      <ul className="mt-3 space-y-4">
        {seasons.map((s) => {
          const start = dayOfYear(s.startMonth, s.startDay) / 365;
          const end = (dayOfYear(s.endMonth, s.endDay) + 1) / 365;
          const segs = start <= end ? [[start, end]] : [[0, end], [start, 1]];
          const color = COLORS[s.speciesSlug ?? ""] ?? "#2f4a3a";
          return (
            <li key={s.id} className="grid grid-cols-[minmax(7rem,11rem)_1fr] items-center gap-x-4">
              <div className="min-w-0">
                <p className="truncate font-display text-lg leading-tight">{s.name}</p>
                <p className="truncate text-xs text-stone">
                  {formatMonthDay(s.startMonth, s.startDay)} – {formatMonthDay(s.endMonth, s.endDay)}
                </p>
              </div>
              <div className="relative h-8 rounded-full bg-mist" role="img" aria-label={`${s.name}: ${formatMonthDay(s.startMonth, s.startDay)} to ${formatMonthDay(s.endMonth, s.endDay)}${s.closedWeekdays.length ? `, no fishing on ${formatWeekdays(s.closedWeekdays)}` : ""}`}>
                <div className="absolute inset-0 grid grid-cols-12" aria-hidden="true">
                  {MONTHS.map((_, i) => (
                    <span key={i} className="border-l border-white/70 first:border-0" />
                  ))}
                </div>
                {segs.map(([a, b], i) => (
                  <span key={i} className="absolute inset-y-1 rounded-full" style={{ left: `${a * 100}%`, width: `${(b - a) * 100}%`, background: color }} />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
