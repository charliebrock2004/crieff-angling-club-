/**
 * Date helpers. Fishing dates are plain ISO dates ('YYYY-MM-DD') in UK time.
 * All arithmetic is done on UTC midnight so DST never shifts a day.
 */
export const CLUB_TIMEZONE = "Europe/London";

export type IsoDate = string;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(v: unknown): v is IsoDate {
  if (typeof v !== "string" || !ISO_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

export function toUtcDate(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function fromUtcDate(d: Date): IsoDate {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = toUtcDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtcDate(d);
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  return Math.round((toUtcDate(a).getTime() - toUtcDate(b).getTime()) / 86_400_000);
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(iso: IsoDate): number {
  return toUtcDate(iso).getUTCDay();
}

export function monthDay(iso: IsoDate): { month: number; day: number } {
  const d = toUtcDate(iso);
  return { month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Today's date and hour in the club's timezone. */
export function clubNow(now: Date = new Date()): { date: IsoDate; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: CLUB_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: Number(get("hour")) };
}

export function clubToday(now?: Date): IsoDate {
  return clubNow(now).date;
}

/**
 * Is the date inside an annually recurring range (inclusive)?
 * Ranges may wrap the year end, e.g. 15 Nov – 15 Jan.
 */
export function inRecurringRange(
  iso: IsoDate,
  range: { startMonth: number; startDay: number; endMonth: number; endDay: number },
): boolean {
  const { month, day } = monthDay(iso);
  const v = month * 100 + day;
  const start = range.startMonth * 100 + range.startDay;
  const end = range.endMonth * 100 + range.endDay;
  return start <= end ? v >= start && v <= end : v >= start || v <= end;
}

/** Length in days of a recurring range (used to prefer the most specific). */
export function recurringRangeLength(range: { startMonth: number; startDay: number; endMonth: number; endDay: number }): number {
  const y = 2001; // non-leap reference year
  const s = Date.UTC(y, range.startMonth - 1, range.startDay);
  let e = Date.UTC(y, range.endMonth - 1, range.endDay);
  if (e < s) e = Date.UTC(y + 1, range.endMonth - 1, range.endDay);
  return Math.round((e - s) / 86_400_000) + 1;
}

export function monthBounds(month: string): { start: IsoDate; end: IsoDate } | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number);
  if (m < 1 || m > 12) return null;
  const start = `${month}-01`;
  const end = fromUtcDate(new Date(Date.UTC(y, m, 0)));
  return { start, end };
}

export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

/** Next occurrence (on or after `from`) of a month/day. */
export function nextOccurrence(from: IsoDate, month: number, day: number): IsoDate {
  const y = toUtcDate(from).getUTCFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fix = (yy: number) => {
    // 29 Feb in a non-leap year -> 28 Feb
    const lastDay = new Date(Date.UTC(yy, month, 0)).getUTCDate();
    return `${yy}-${pad(month)}-${pad(Math.min(day, lastDay))}`;
  };
  const candidate = fix(y);
  return candidate >= from ? candidate : fix(y + 1);
}
