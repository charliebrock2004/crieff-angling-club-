import { toUtcDate, type IsoDate } from "./dates";

export function formatMoney(pence: number): string {
  const pounds = pence / 100;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: pence % 100 === 0 ? 0 : 2,
  }).format(pounds);
}

export function formatDate(iso: IsoDate, style: "long" | "short" | "full" = "long"): string {
  const opts: Intl.DateTimeFormatOptions =
    style === "full"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : style === "long"
        ? { weekday: "short", day: "numeric", month: "long", year: "numeric" }
        : { day: "numeric", month: "short", year: "numeric" };
  return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(toUtcDate(iso));
}

export function formatDateTime(value: Date | string): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  }).format(d);
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function monthName(m: number): string {
  return MONTHS[m - 1] ?? "";
}

export function formatMonthDay(month: number, day: number): string {
  return `${day} ${MONTHS[month - 1]}`;
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function formatWeekdays(days: number[]): string {
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS[d] + "s")
    .join(" & ");
}

export function pluralise(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
