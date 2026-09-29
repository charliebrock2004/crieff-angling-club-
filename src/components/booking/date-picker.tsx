"use client";
import { useEffect, useMemo, useState } from "react";
import type { CalendarDay, DayStatus } from "@/lib/booking/types";
import { cn } from "../ui/cn";

const WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const STATUS_LABEL: Record<DayStatus, string> = {
  available: "Permits available",
  limited: "Only a few permits left",
  full: "Fully booked",
  blocked: "Not available",
  closed: "No fishing available",
};

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export interface CalendarFilter {
  water?: string | null;
  beat?: string | null;
  permit?: string | null;
}

/**
 * Availability-aware date picker. Only dates the server says can be booked
 * are selectable; everything else is disabled with an explanation.
 */
export function DatePicker({ value, onChange, filter, initialMonth }: { value: string | null; onChange: (date: string) => void; filter: CalendarFilter; initialMonth: string }) {
  const [month, setMonth] = useState(initialMonth);
  const [data, setData] = useState<{ days: CalendarDay[]; first: string; last: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filterKey = `${filter.water ?? ""}|${filter.beat ?? ""}|${filter.permit ?? ""}`;
  const requestKey = `${month}|${filterKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    const ctrl = new AbortController();
    const q = new URLSearchParams({ month });
    if (filter.water) q.set("water", filter.water);
    if (filter.beat) q.set("beat", filter.beat);
    if (filter.permit) q.set("permit", filter.permit);
    fetch(`/api/availability/calendar?${q}`, { signal: ctrl.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not load availability");
        setData(j);
        setError(null);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoadedKey(requestKey);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const lead = (first.getUTCDay() + 6) % 7; // Monday first
    const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const byDate = new Map((data?.days ?? []).map((d) => [d.date, d]));
    const out: ({ date: string; day: number; info?: CalendarDay } | null)[] = Array(lead).fill(null);
    for (let d = 1; d <= count; d++) {
      const date = `${month}-${String(d).padStart(2, "0")}`;
      out.push({ date, day: d, info: byDate.get(date) });
    }
    return out;
  }, [month, data]);

  const [y, m] = month.split("-").map(Number);
  const canPrev = data ? month > data.first.slice(0, 7) : false;
  const canNext = data ? month < data.last.slice(0, 7) : true;
  const openCount = data?.days.filter((d) => d.status === "available" || d.status === "limited").length ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} disabled={!canPrev} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line hover:bg-mist disabled:opacity-30" aria-label="Previous month">
          <span aria-hidden="true">←</span>
        </button>
        <h3 className="font-display text-2xl" aria-live="polite">
          {MONTHS[m - 1]} {y}
        </h3>
        <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} disabled={!canNext} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line hover:bg-mist disabled:opacity-30" aria-label="Next month">
          <span aria-hidden="true">→</span>
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-6 rounded-xl bg-bad-bg p-4 text-sm text-bad">{error}</p>
      ) : (
        <div className={cn("mt-5 transition-opacity", loading && "opacity-50")} aria-busy={loading}>
          <div className="grid grid-cols-7 text-center text-[0.7rem] font-semibold uppercase tracking-wider text-stone" aria-hidden="true">
            {WEEK.map((d) => (
              <span key={d} className="py-2">{d}</span>
            ))}
          </div>
          <div role="grid" aria-label={`${MONTHS[m - 1]} ${y}`} className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {cells.map((c, i) => {
              if (!c) return <span key={`e${i}`} aria-hidden="true" />;
              const status = c.info?.status ?? "closed";
              const selectable = status === "available" || status === "limited";
              const selected = value === c.date;
              return (
                <button
                  key={c.date}
                  type="button"
                  role="gridcell"
                  disabled={!selectable}
                  aria-selected={selected}
                  aria-label={`${c.day} ${MONTHS[m - 1]}: ${c.info?.note ?? STATUS_LABEL[status]}`}
                  title={c.info?.note ?? STATUS_LABEL[status]}
                  onClick={() => onChange(c.date)}
                  className={cn(
                    "relative flex aspect-square flex-col items-center justify-center rounded-xl text-[0.95rem] font-medium transition sm:text-base",
                    selected && "bg-peat text-bone shadow-md",
                    !selected && selectable && "bg-white text-peat ring-1 ring-line hover:ring-2 hover:ring-peat",
                    status === "full" && "bg-bad-bg/60 text-bad/70 line-through decoration-1",
                    status === "blocked" && "bg-mist text-stone/60 [background-image:repeating-linear-gradient(135deg,transparent_0_5px,rgb(20_34_29/0.06)_5px_6px)]",
                    status === "closed" && "text-stone/35",
                  )}
                >
                  {c.day}
                  {selectable && (
                    <span aria-hidden="true" className={cn("absolute bottom-1.5 h-1 w-1 rounded-full sm:h-1.5 sm:w-1.5", selected ? "bg-bracken" : status === "limited" ? "bg-bracken" : "bg-good")} />
                  )}
                </button>
              );
            })}
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-stone">
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-good" /> Available</li>
            <li className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-bracken" /> Few left</li>
            <li className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-bad-bg" /> Full</li>
            <li className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-mist" /> Blocked / closed</li>
          </ul>
          {!loading && openCount === 0 && (
            <p className="mt-4 rounded-xl bg-mist p-4 text-sm text-stone">No dates available in this month for your selection. Try the next month{filter.permit || filter.beat ? ", or clear your beat/permit filter" : ""}.</p>
          )}
        </div>
      )}
    </div>
  );
}
