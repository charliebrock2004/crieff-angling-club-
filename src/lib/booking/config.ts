import type { Db } from "../db";
import { addDays, type IsoDate } from "../dates";
import type { BookingConfig, Usage } from "./types";
import { key } from "./engine";


function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Loads every rule the availability engine needs, in a handful of queries. */
export async function loadBookingConfig(db: Db, opts: { overridesFrom?: IsoDate; overridesTo?: IsoDate } = {}): Promise<BookingConfig> {
  const from = opts.overridesFrom ?? "1900-01-01";
  const to = opts.overridesTo ?? "2999-12-31";
  const [waters, beats, permitTypes, prices, seasons, overrides, boats, settings] = await Promise.all([
    db`select id, slug, name, kind, booking_enabled, is_published, sort_order from public.waters order by sort_order, name`,
    db`select id, water_id, slug, name, daily_capacity, booking_enabled, is_published, sort_order from public.beats order by sort_order, name`,
    db`
      select p.*,
        coalesce((select array_agg(beat_id) from public.permit_type_beats where permit_type_id = p.id), '{}') as beat_ids,
        coalesce((select array_agg(s.id order by s.sort_order) from public.permit_type_species ps join public.species s on s.id = ps.species_id where ps.permit_type_id = p.id), '{}') as species_ids,
        coalesce((select array_agg(s.name order by s.sort_order) from public.permit_type_species ps join public.species s on s.id = ps.species_id where ps.permit_type_id = p.id), '{}') as species_names
      from public.permit_types p order by p.sort_order, p.name`,
    db`select * from public.permit_prices`,
    db`select id, name, start_month, start_day, end_month, end_day, closed_weekdays from public.fishing_seasons`,
    db`select * from public.availability_overrides where end_date >= ${from} and start_date <= ${to}`,
    db`select * from public.boats order by sort_order, name`,
    db`select key, value from public.settings where key in ('booking_hold_minutes', 'booking_max_days_ahead', 'booking_same_day_cutoff_hour')`,
  ]);
  const setting = (k: string) => settings.find((s) => s.key === k)?.value;

  return {
    waters: waters.map((w) => ({
      id: w.id,
      slug: w.slug,
      name: w.name,
      kind: w.kind,
      bookingEnabled: w.booking_enabled,
      isPublished: w.is_published,
      sortOrder: w.sort_order,
    })),
    beats: beats.map((b) => ({
      id: b.id,
      waterId: b.water_id,
      slug: b.slug,
      name: b.name,
      dailyCapacity: b.daily_capacity,
      bookingEnabled: b.booking_enabled,
      isPublished: b.is_published,
      sortOrder: b.sort_order,
    })),
    permitTypes: permitTypes.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      waterId: p.water_id,
      seasonId: p.season_id,
      isJunior: p.is_junior,
      minAge: p.min_age,
      maxAge: p.max_age,
      maxPerBooking: p.max_per_booking,
      dailyLimit: p.daily_limit,
      requiresBoat: p.requires_boat,
      conditions: p.conditions,
      isActive: p.is_active,
      sortOrder: p.sort_order,
      beatIds: p.beat_ids,
      speciesIds: p.species_ids,
      speciesNames: p.species_names,
    })),
    prices: prices.map((p) => ({
      id: p.id,
      permitTypeId: p.permit_type_id,
      label: p.label,
      startMonth: p.start_month,
      startDay: p.start_day,
      endMonth: p.end_month,
      endDay: p.end_day,
      pricePence: p.price_pence,
      closedWeekdays: p.closed_weekdays.map(Number),
      saleEnabled: p.sale_enabled,
    })),
    seasons: seasons.map((s) => ({
      id: s.id,
      name: s.name,
      startMonth: s.start_month,
      startDay: s.start_day,
      endMonth: s.end_month,
      endDay: s.end_day,
      closedWeekdays: s.closed_weekdays.map(Number),
    })),
    overrides: overrides.map((o) => ({
      id: o.id,
      waterId: o.water_id,
      beatId: o.beat_id,
      permitTypeId: o.permit_type_id,
      startDate: o.start_date,
      endDate: o.end_date,
      isBlocked: o.is_blocked,
      capacity: o.capacity,
      publicNote: o.public_note,
      createdAt: new Date(o.created_at).toISOString(),
    })),
    boats: boats.map((b) => ({
      id: b.id,
      waterId: b.water_id,
      name: b.name,
      capacityAnglers: b.capacity_anglers,
      hirePricePence: b.hire_price_pence,
      isActive: b.is_active,
      sortOrder: b.sort_order,
    })),
    settings: {
      holdMinutes: Math.max(30, num(setting("booking_hold_minutes"), 30)),
      maxDaysAhead: Math.max(1, num(setting("booking_max_days_ahead"), 365)),
      sameDayCutoffHour: Math.min(24, Math.max(0, num(setting("booking_same_day_cutoff_hour"), 20))),
    },
  };
}

/** Active (paid, or pending with an unexpired hold) usage in a date range. */
export async function loadUsage(db: Db, start: IsoDate, end: IsoDate): Promise<Usage> {
  const [rows, boats] = await Promise.all([
    db`
      select beat_id, permit_type_id, fishing_date, sum(quantity)::int as qty
      from public.bookings
      where fishing_date between ${start} and ${end}
        and public.booking_is_active(status, hold_expires_at)
      group by beat_id, permit_type_id, fishing_date`,
    db`
      select bb.boat_id, bb.fishing_date
      from public.boat_bookings bb join public.bookings b on b.id = bb.booking_id
      where bb.fishing_date between ${start} and ${end}
        and bb.released_at is null
        and public.booking_is_active(b.status, b.hold_expires_at)`,
  ]);
  const usage: Usage = { beatDay: new Map(), beatTypeDay: new Map(), boatsTaken: new Map() };
  for (const r of rows) {
    const bd = key.beatDay(r.beat_id, r.fishing_date);
    usage.beatDay.set(bd, (usage.beatDay.get(bd) ?? 0) + r.qty);
    usage.beatTypeDay.set(key.beatTypeDay(r.beat_id, r.permit_type_id, r.fishing_date), r.qty);
  }
  for (const b of boats) {
    const set = usage.boatsTaken.get(b.fishing_date) ?? new Set<string>();
    set.add(b.boat_id);
    usage.boatsTaken.set(b.fishing_date, set);
  }
  return usage;
}

export async function loadUsageForDay(db: Db, date: IsoDate): Promise<Usage> {
  return loadUsage(db, date, addDays(date, 0));
}
