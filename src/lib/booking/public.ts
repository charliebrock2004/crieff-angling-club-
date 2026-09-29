import "server-only";
import { sql } from "../db";
import { addDays, clubToday, monthBounds, type IsoDate } from "../dates";
import { calendar, dayOptions } from "./engine";
import { loadBookingConfig, loadUsage } from "./config";
import type { CalendarDay } from "./types";

export interface DayPermitOption {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isJunior: boolean;
  requiresBoat: boolean;
  maxPerBooking: number;
  sellable: boolean;
  reason: string | null;
  message: string | null;
  remaining: number;
  maxQuantity: number;
  pricePence: number | null;
  priceLabel: string | null;
  boatFeePence: number;
  boatsFree: number | null;
  boatsTotal: number | null;
  speciesIds: string[];
  speciesNames: string[];
  conditions: string | null;
}
export interface DayBeatOption {
  id: string;
  slug: string;
  name: string;
  sellable: boolean;
  capacity: number;
  booked: number;
  remaining: number;
  permits: DayPermitOption[];
}
export interface DayWaterOption {
  id: string;
  slug: string;
  name: string;
  kind: string;
  sellable: boolean;
  beats: DayBeatOption[];
}
export interface BookingRule {
  id: string;
  category: string;
  waterId: string | null;
  beatId: string | null;
  speciesId: string | null;
  showAtBooking: boolean;
  requiresAcknowledgement: boolean;
  title: string;
  body: string;
}

export async function getCalendar(month: string, filter: { water?: string | null; beat?: string | null; permit?: string | null }): Promise<{ days: CalendarDay[]; first: IsoDate; last: IsoDate } | null> {
  const bounds = monthBounds(month);
  if (!bounds) return null;
  const cfg = await loadBookingConfig(sql, { overridesFrom: bounds.start, overridesTo: bounds.end });
  const usage = await loadUsage(sql, bounds.start, bounds.end);
  const find = <T extends { id: string; slug: string }>(list: T[], v?: string | null) => (v ? list.find((x) => x.id === v || x.slug === v) : undefined);
  const days = calendar(cfg, usage, bounds.start, bounds.end, {
    waterId: find(cfg.waters, filter.water)?.id ?? null,
    beatId: find(cfg.beats, filter.beat)?.id ?? null,
    permitTypeId: find(cfg.permitTypes, filter.permit)?.id ?? null,
  });
  const today = clubToday();
  return { days, first: today, last: addDays(today, cfg.settings.maxDaysAhead) };
}

export async function getDayOptions(date: IsoDate): Promise<{ waters: DayWaterOption[]; rules: BookingRule[] }> {
  const [cfg, usage, rules] = await Promise.all([
    loadBookingConfig(sql, { overridesFrom: date, overridesTo: date }),
    loadUsage(sql, date, date),
    sql`select id, category, water_id, beat_id, species_id, show_at_booking, requires_acknowledgement, title, body
        from public.rules where is_published and show_at_booking order by category, sort_order`,
  ]);
  const tree = dayOptions(cfg, usage, date);
  return {
    waters: tree.map((w) => ({
      id: w.water.id,
      slug: w.water.slug,
      name: w.water.name,
      kind: w.water.kind,
      sellable: w.sellable,
      beats: w.beats.map((b) => {
        const cap = b.permits[0]?.capacity ?? b.beat.dailyCapacity;
        const booked = b.permits[0]?.booked ?? 0;
        return {
          id: b.beat.id,
          slug: b.beat.slug,
          name: b.beat.name,
          sellable: b.sellable,
          capacity: cap,
          booked,
          remaining: Math.max(0, cap - booked),
          permits: b.permits.map((p) => ({
            id: p.permit.id,
            slug: p.permit.slug,
            name: p.permit.name,
            description: p.permit.description,
            isJunior: p.permit.isJunior,
            requiresBoat: p.permit.requiresBoat,
            maxPerBooking: p.permit.maxPerBooking,
            sellable: p.sellable,
            reason: p.reason,
            message: p.message,
            remaining: p.remaining,
            maxQuantity: p.maxQuantity,
            pricePence: p.price?.pricePence ?? null,
            priceLabel: p.price?.label ?? null,
            boatFeePence: p.boatFeePence,
            boatsFree: p.boatsFree,
            boatsTotal: p.boatsTotal,
            speciesIds: p.permit.speciesIds,
            speciesNames: p.permit.speciesNames,
            conditions: p.permit.conditions,
          })),
        };
      }),
    })),
    rules: rules.map((r) => ({
      id: r.id,
      category: r.category,
      waterId: r.water_id,
      beatId: r.beat_id,
      speciesId: r.species_id,
      showAtBooking: r.show_at_booking,
      requiresAcknowledgement: r.requires_acknowledgement,
      title: r.title,
      body: r.body,
    })),
  };
}
