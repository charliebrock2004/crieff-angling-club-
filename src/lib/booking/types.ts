import type { IsoDate } from "../dates";

export interface RecurringRange {
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
}

export interface WaterCfg {
  id: string;
  slug: string;
  name: string;
  kind: "river" | "loch";
  bookingEnabled: boolean;
  isPublished: boolean;
  sortOrder: number;
}

export interface BeatCfg {
  id: string;
  waterId: string;
  slug: string;
  name: string;
  dailyCapacity: number;
  bookingEnabled: boolean;
  isPublished: boolean;
  sortOrder: number;
}

export interface SeasonCfg extends RecurringRange {
  id: string;
  name: string;
  closedWeekdays: number[];
}

export interface PriceCfg extends RecurringRange {
  id: string;
  permitTypeId: string;
  label: string;
  pricePence: number;
  closedWeekdays: number[];
  saleEnabled: boolean;
}

export interface PermitTypeCfg {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  waterId: string;
  seasonId: string | null;
  isJunior: boolean;
  minAge: number | null;
  maxAge: number | null;
  maxPerBooking: number;
  dailyLimit: number | null;
  requiresBoat: boolean;
  conditions: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Beats this permit is valid on. Empty = every beat on the water. */
  beatIds: string[];
  speciesIds: string[];
  speciesNames: string[];
}

export interface OverrideCfg {
  id: string;
  waterId: string | null;
  beatId: string | null;
  permitTypeId: string | null;
  startDate: IsoDate;
  endDate: IsoDate;
  isBlocked: boolean;
  capacity: number | null;
  publicNote: string | null;
  createdAt: string;
}

export interface BoatCfg {
  id: string;
  waterId: string;
  name: string;
  capacityAnglers: number;
  hirePricePence: number;
  isActive: boolean;
  sortOrder: number;
}

export interface BookingSettings {
  holdMinutes: number;
  maxDaysAhead: number;
  sameDayCutoffHour: number;
}

export interface BookingConfig {
  waters: WaterCfg[];
  beats: BeatCfg[];
  permitTypes: PermitTypeCfg[];
  prices: PriceCfg[];
  seasons: SeasonCfg[];
  overrides: OverrideCfg[];
  boats: BoatCfg[];
  settings: BookingSettings;
}

/** Live usage for a date range (active bookings only). */
export interface Usage {
  /** key `${beatId}|${date}` -> permits booked */
  beatDay: Map<string, number>;
  /** key `${beatId}|${permitTypeId}|${date}` -> permits booked */
  beatTypeDay: Map<string, number>;
  /** key `${date}` -> boat ids held */
  boatsTaken: Map<string, Set<string>>;
}

export type UnavailableReason =
  | "past"
  | "too_far_ahead"
  | "same_day_closed"
  | "water_closed"
  | "beat_closed"
  | "permit_inactive"
  | "not_on_beat"
  | "out_of_season"
  | "closed_weekday"
  | "no_price"
  | "blocked"
  | "full"
  | "no_boats";

export interface PermitAvailability {
  permitTypeId: string;
  beatId: string;
  date: IsoDate;
  sellable: boolean;
  reason: UnavailableReason | null;
  message: string | null;
  capacity: number;
  booked: number;
  remaining: number;
  maxQuantity: number;
  price: PriceCfg | null;
  boatFeePence: number;
  boatsFree: number | null;
  boatsTotal: number | null;
}

export type DayStatus = "available" | "limited" | "full" | "blocked" | "closed";

export interface CalendarDay {
  date: IsoDate;
  status: DayStatus;
  remaining: number;
  fromPricePence: number | null;
  note: string | null;
}
