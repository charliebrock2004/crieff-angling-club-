/**
 * Pure availability engine. No I/O: everything it needs is passed in, which
 * makes it fully unit-testable and lets the calendar, the booking step and
 * the server-side checkout validation all share exactly the same rules.
 *
 * The database trigger `enforce_booking_capacity` is the final authority on
 * capacity; this module decides what may be offered and sold.
 */
import { addDays, clubNow, diffDays, eachDay, inRecurringRange, recurringRangeLength, weekday, type IsoDate } from "../dates";
import type {
  BeatCfg,
  BookingConfig,
  CalendarDay,
  DayStatus,
  PermitAvailability,
  PermitTypeCfg,
  PriceCfg,
  UnavailableReason,
  Usage,
} from "./types";

export const REASON_MESSAGES: Record<UnavailableReason, string> = {
  past: "This date has passed.",
  too_far_ahead: "Bookings are not open this far ahead yet.",
  same_day_closed: "Online booking for today has closed.",
  water_closed: "This water is not currently taking bookings.",
  beat_closed: "This beat is not currently taking bookings.",
  permit_inactive: "This permit is not currently available.",
  not_on_beat: "This permit is not valid on this beat.",
  out_of_season: "Out of season.",
  closed_weekday: "No fishing on this day of the week.",
  no_price: "No day permits are sold on this date.",
  blocked: "Not available on this date.",
  full: "Fully booked.",
  no_boats: "All boats are booked.",
};

export const key = {
  beatDay: (beatId: string, date: IsoDate) => `${beatId}|${date}`,
  beatTypeDay: (beatId: string, permitTypeId: string, date: IsoDate) => `${beatId}|${permitTypeId}|${date}`,
};

export function emptyUsage(): Usage {
  return { beatDay: new Map(), beatTypeDay: new Map(), boatsTaken: new Map() };
}

/** Beats a permit type can be used on (published + on the permit's water). */
export function beatsForPermit(cfg: BookingConfig, permit: PermitTypeCfg): BeatCfg[] {
  return cfg.beats
    .filter((b) => b.waterId === permit.waterId && (permit.beatIds.length === 0 || permit.beatIds.includes(b.id)))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function blockFor(
  cfg: BookingConfig,
  beat: BeatCfg,
  date: IsoDate,
  permitTypeId?: string,
): { blocked: boolean; note: string | null } {
  const hit = cfg.overrides.find(
    (o) =>
      o.isBlocked &&
      date >= o.startDate &&
      date <= o.endDate &&
      (o.beatId === beat.id || (o.beatId === null && (o.waterId === beat.waterId || o.waterId === null))) &&
      (o.permitTypeId === null || o.permitTypeId === permitTypeId),
  );
  return { blocked: !!hit, note: hit?.publicNote ?? null };
}

/** Mirrors SQL public.effective_capacity (without the blocked check). */
export function capacityFor(cfg: BookingConfig, beat: BeatCfg, date: IsoDate): number {
  const candidates = cfg.overrides
    .filter(
      (o) =>
        !o.isBlocked &&
        o.capacity !== null &&
        date >= o.startDate &&
        date <= o.endDate &&
        (o.beatId === beat.id || (o.beatId === null && (o.waterId === beat.waterId || o.waterId === null))),
    )
    .sort((a, b) => {
      const spec = (o: typeof a) => (o.beatId ? 2 : 0) + (o.waterId ? 1 : 0);
      return spec(b) - spec(a) || (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0);
    });
  return candidates[0]?.capacity ?? beat.dailyCapacity;
}

/** The price period covering the date, if the permit is on sale that day. */
export function priceFor(cfg: BookingConfig, permit: PermitTypeCfg, date: IsoDate): { price: PriceCfg | null; closedWeekday: boolean } {
  const dow = weekday(date);
  const covering = cfg.prices
    .filter((p) => p.permitTypeId === permit.id && p.saleEnabled && inRecurringRange(date, p))
    .sort((a, b) => recurringRangeLength(a) - recurringRangeLength(b));
  const open = covering.find((p) => !p.closedWeekdays.includes(dow));
  return { price: open ?? null, closedWeekday: !open && covering.length > 0 };
}

export interface EvaluateOptions {
  now?: Date;
  /** Admin/manual bookings may ignore lead-time rules. */
  ignoreBookingWindow?: boolean;
}

export function evaluate(
  cfg: BookingConfig,
  usage: Usage,
  permit: PermitTypeCfg,
  beat: BeatCfg,
  date: IsoDate,
  opts: EvaluateOptions = {},
): PermitAvailability {
  const capacity = capacityFor(cfg, beat, date);
  const booked = usage.beatDay.get(key.beatDay(beat.id, date)) ?? 0;
  const bookedType = usage.beatTypeDay.get(key.beatTypeDay(beat.id, permit.id, date)) ?? 0;
  const { price, closedWeekday } = priceFor(cfg, permit, date);
  const water = cfg.waters.find((w) => w.id === permit.waterId);
  const boats = permit.requiresBoat ? cfg.boats.filter((b) => b.isActive && b.waterId === permit.waterId) : [];
  const taken = usage.boatsTaken.get(date) ?? new Set<string>();
  const freeBoats = boats.filter((b) => !taken.has(b.id));
  const largestFreeBoat = freeBoats.reduce((m, b) => Math.max(m, b.capacityAnglers), 0);
  const cheapestBoatFee = freeBoats.length ? Math.min(...freeBoats.map((b) => b.hirePricePence)) : 0;

  let remaining = Math.max(0, capacity - booked);
  if (permit.dailyLimit !== null) remaining = Math.min(remaining, Math.max(0, permit.dailyLimit - bookedType));
  if (permit.requiresBoat) remaining = Math.min(remaining, largestFreeBoat);

  const base: PermitAvailability = {
    permitTypeId: permit.id,
    beatId: beat.id,
    date,
    sellable: false,
    reason: null,
    message: null,
    capacity,
    booked,
    remaining,
    maxQuantity: Math.min(remaining, permit.maxPerBooking),
    price,
    boatFeePence: permit.requiresBoat ? cheapestBoatFee : 0,
    boatsFree: permit.requiresBoat ? freeBoats.length : null,
    boatsTotal: permit.requiresBoat ? boats.length : null,
  };
  const fail = (reason: UnavailableReason, message?: string | null): PermitAvailability => ({
    ...base,
    reason,
    message: message ?? REASON_MESSAGES[reason],
    maxQuantity: 0,
  });

  if (!opts.ignoreBookingWindow) {
    const now = clubNow(opts.now);
    if (date < now.date) return fail("past");
    if (diffDays(date, now.date) > cfg.settings.maxDaysAhead) return fail("too_far_ahead");
    if (date === now.date && now.hour >= cfg.settings.sameDayCutoffHour) return fail("same_day_closed");
  }
  if (!water || !water.bookingEnabled || !water.isPublished) return fail("water_closed");
  if (!beat.bookingEnabled || !beat.isPublished || beat.waterId !== permit.waterId) return fail("beat_closed");
  if (!permit.isActive) return fail("permit_inactive");
  if (permit.beatIds.length > 0 && !permit.beatIds.includes(beat.id)) return fail("not_on_beat");

  if (permit.seasonId) {
    const season = cfg.seasons.find((s) => s.id === permit.seasonId);
    if (season) {
      if (!inRecurringRange(date, season)) return fail("out_of_season");
      if (season.closedWeekdays.includes(weekday(date))) return fail("closed_weekday");
    }
  }
  if (!price) return fail(closedWeekday ? "closed_weekday" : "no_price");

  const block = blockFor(cfg, beat, date, permit.id);
  if (block.blocked) return fail("blocked", block.note ?? REASON_MESSAGES.blocked);
  if (permit.requiresBoat && freeBoats.length === 0) return fail("no_boats");
  if (remaining <= 0) return fail("full");

  return { ...base, sellable: true };
}

export interface DayOptionPermit extends PermitAvailability {
  permit: PermitTypeCfg;
}
export interface DayOptionBeat {
  beat: BeatCfg;
  permits: DayOptionPermit[];
  sellable: boolean;
}
export interface DayOptionWater {
  water: BookingConfig["waters"][number];
  beats: DayOptionBeat[];
  sellable: boolean;
}

/** Everything that could be booked on a date, grouped water → beat → permit. */
export function dayOptions(cfg: BookingConfig, usage: Usage, date: IsoDate, opts: EvaluateOptions = {}): DayOptionWater[] {
  return cfg.waters
    .filter((w) => w.isPublished)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((water) => {
      const beats = cfg.beats
        .filter((b) => b.waterId === water.id && b.isPublished)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((beat) => {
          const permits = cfg.permitTypes
            .filter((p) => p.waterId === water.id && p.isActive && (p.beatIds.length === 0 || p.beatIds.includes(beat.id)))
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((permit) => ({ ...evaluate(cfg, usage, permit, beat, date, opts), permit }));
          return { beat, permits, sellable: permits.some((p) => p.sellable) };
        });
      return { water, beats, sellable: beats.some((b) => b.sellable) };
    });
}

export interface CalendarFilter {
  waterId?: string | null;
  beatId?: string | null;
  permitTypeId?: string | null;
}

/**
 * Summarise each day for the date picker. A day is:
 *   closed    – nothing matching the filter is on sale (season, weekday, window)
 *   blocked   – on sale in principle, but blocked by the club
 *   full      – on sale, but no permits left
 *   limited   – 1–2 permits left on the best option
 *   available – otherwise
 */
export function calendar(
  cfg: BookingConfig,
  usage: Usage,
  start: IsoDate,
  end: IsoDate,
  filter: CalendarFilter = {},
  opts: EvaluateOptions = {},
): CalendarDay[] {
  const permits = cfg.permitTypes.filter(
    (p) => p.isActive && (!filter.permitTypeId || p.id === filter.permitTypeId) && (!filter.waterId || p.waterId === filter.waterId),
  );
  const pairs = permits.flatMap((permit) =>
    beatsForPermit(cfg, permit)
      .filter((b) => b.isPublished && (!filter.beatId || b.id === filter.beatId))
      .map((beat) => ({ permit, beat })),
  );

  return eachDay(start, end).map((date) => {
    let best = 0;
    let fromPrice: number | null = null;
    let anySellable = false;
    let anyBlocked = false;
    let anyFull = false;
    let note: string | null = null;
    for (const { permit, beat } of pairs) {
      const a = evaluate(cfg, usage, permit, beat, date, opts);
      if (a.sellable) {
        anySellable = true;
        best = Math.max(best, a.remaining);
        const unit = a.price?.pricePence ?? 0;
        fromPrice = fromPrice === null ? unit : Math.min(fromPrice, unit);
      } else if (a.reason === "blocked") {
        anyBlocked = true;
        note ??= a.message;
      } else if (a.reason === "full" || a.reason === "no_boats") {
        anyFull = true;
      }
    }
    let status: DayStatus;
    if (anySellable) status = best <= 2 ? "limited" : "available";
    else if (anyFull) status = "full";
    else if (anyBlocked) status = "blocked";
    else status = "closed";
    return { date, status, remaining: best, fromPricePence: fromPrice, note: status === "blocked" ? note : null };
  });
}

/** Rule filtering for a permit on a beat (used to surface rules at booking). */
export interface RuleLike {
  id: string;
  category: string;
  waterId: string | null;
  beatId: string | null;
  speciesId: string | null;
  showAtBooking: boolean;
  requiresAcknowledgement: boolean;
}

export function rulesForBooking<T extends RuleLike>(
  rules: T[],
  ctx: { waterId: string; beatId: string; speciesIds: string[]; requiresBoat: boolean },
): T[] {
  return rules.filter((r) => {
    if (!r.showAtBooking) return false;
    if (r.waterId && r.waterId !== ctx.waterId) return false;
    if (r.beatId && r.beatId !== ctx.beatId) return false;
    if (r.speciesId && !ctx.speciesIds.includes(r.speciesId)) return false;
    if (r.category === "boat" && !ctx.requiresBoat) return false;
    return true;
  });
}

/** Days from today used for "book up to" UI limits. */
export function bookingWindow(cfg: BookingConfig, now?: Date): { first: IsoDate; last: IsoDate } {
  const today = clubNow(now).date;
  return { first: today, last: addDays(today, cfg.settings.maxDaysAhead) };
}
